import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Lightweight analytics event log (page views + quiz funnel).
 *
 * Sharded per WEEK (`events-w-<monday>.json`): a pageview only rewrites the
 * current week's document instead of the whole history — bounding document
 * growth, containing concurrent-write races to one week's log, and keeping
 * dashboard reads to ~6 subrequests (35 days ÷ 7) instead of one per day,
 * well inside the Workers per-request subrequest limit. A per-week cap
 * protects the KV free-tier write quota from traffic spikes (beyond it,
 * tracking degrades gracefully). Reads merge recent shards plus the pre-shard
 * legacy `events.json` so existing installs keep their history.
 */
export type EventType = "pageview" | "quiz_start" | "quiz_step" | "quiz_submit";

export interface SiteEvent {
  id: string;
  type: EventType;
  path: string;
  locale: string;
  sessionId: string;
  meta?: Record<string, string | number>;
  createdAt: string;
}

const LEGACY_KEY = "events.json";
const READ_DAYS = 35; // covers the dashboard's 30-day window
// Pageviews are high-volume, so a single weekly doc read-modify-write races and
// throttles under load (KV has no transactions + ~1 write/s per key). Spread
// each week across N random shards: a write only contends with the ~1/N of
// traffic hitting the same shard, cutting lost-updates and per-key write rate
// by N×. Reads merge all shards. (Append-log-per-item — used for low-volume
// leads — is unsuitable here: one KV key per pageview would explode key count.)
// 4 shards keeps dashboard reads within the Workers free-tier subrequest budget
// (~6 weeks x (1 legacy + 4 shards) + legacy ≈ 31 KV reads, well under 50) while
// still cutting write contention 4x. High-traffic sites on Workers Paid can raise it.
const WRITE_SHARDS = 4;
const MAX_PER_SHARD = 700; // ~2800 events/week/site cap, spread across shards

/** The Monday (UTC) of the week containing `d`, as an ISO date. */
function weekMonday(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (day.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  day.setUTCDate(day.getUTCDate() - dow);
  return day.toISOString().slice(0, 10);
}

/** Legacy single-doc weekly key — still read so existing history survives. */
export function weekKey(d: Date): string {
  return `events-w-${weekMonday(d)}.json`;
}
/** Sharded weekly key for a given shard index. */
function shardKey(d: Date, shard: number): string {
  return `events-w-${weekMonday(d)}-s${shard}.json`;
}

export const EVENT_TYPES: EventType[] = ["pageview", "quiz_start", "quiz_step", "quiz_submit"];

export async function appendEvent(input: {
  type: EventType;
  path: string;
  locale: string;
  sessionId: string;
  meta?: Record<string, string | number>;
}): Promise<void> {
  const now = new Date();
  const key = shardKey(now, Math.floor(Math.random() * WRITE_SHARDS));
  const events = await readJsonDoc<SiteEvent[]>(key, []);
  if (events.length >= MAX_PER_SHARD) return; // per-shard quota guard — drop, never fail
  events.push({
    id: randomUUID(),
    type: input.type,
    path: String(input.path).slice(0, 200),
    locale: String(input.locale ?? "en").slice(0, 5),
    sessionId: String(input.sessionId).slice(0, 64),
    meta: input.meta,
    createdAt: now.toISOString(),
  });
  await writeJsonDoc(key, events);
}

export async function getEvents(days = READ_DAYS): Promise<SiteEvent[]> {
  const keys = new Set<string>();
  const addWeek = (d: Date) => {
    keys.add(weekKey(d)); // legacy single doc (pre-sharding history)
    for (let s = 0; s < WRITE_SHARDS; s++) keys.add(shardKey(d, s));
  };
  for (let i = 0; i <= days; i += 7) addWeek(new Date(Date.now() - i * 86_400_000));
  addWeek(new Date(Date.now() - days * 86_400_000));
  const shards = await Promise.all([...keys].map((k) => readJsonDoc<SiteEvent[]>(k, [])));
  // Pre-shard installs keep their history via the legacy document.
  const legacy = await readJsonDoc<SiteEvent[]>(LEGACY_KEY, []);
  return shards.flat().concat(legacy).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
