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
const MAX_PER_WEEK = 2500;
const READ_DAYS = 35; // covers the dashboard's 30-day window

/** Shard key: the Monday (UTC) of the week containing `d`. */
export function weekKey(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (day.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  day.setUTCDate(day.getUTCDate() - dow);
  return `events-w-${day.toISOString().slice(0, 10)}.json`;
}

export const EVENT_TYPES: EventType[] = ["pageview", "quiz_start", "quiz_step", "quiz_submit"];

export async function appendEvent(input: {
  type: EventType;
  path: string;
  locale: string;
  sessionId: string;
  meta?: Record<string, string | number>;
}): Promise<void> {
  const key = weekKey(new Date());
  const events = await readJsonDoc<SiteEvent[]>(key, []);
  if (events.length >= MAX_PER_WEEK) return; // quota guard — drop, never fail
  events.push({
    id: randomUUID(),
    type: input.type,
    path: String(input.path).slice(0, 200),
    locale: String(input.locale ?? "en").slice(0, 5),
    sessionId: String(input.sessionId).slice(0, 64),
    meta: input.meta,
    createdAt: new Date().toISOString(),
  });
  await writeJsonDoc(key, events);
}

export async function getEvents(days = READ_DAYS): Promise<SiteEvent[]> {
  const keys = new Set<string>();
  for (let i = 0; i <= days; i += 7) keys.add(weekKey(new Date(Date.now() - i * 86_400_000)));
  keys.add(weekKey(new Date(Date.now() - days * 86_400_000)));
  const shards = await Promise.all([...keys].map((k) => readJsonDoc<SiteEvent[]>(k, [])));
  // Pre-shard installs keep their history via the legacy document.
  const legacy = await readJsonDoc<SiteEvent[]>(LEGACY_KEY, []);
  return shards.flat().concat(legacy).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
