import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Lightweight analytics event log (page views + quiz funnel). File-backed and
 * capped so it stays bounded; swap to a real analytics store later without
 * touching callers. The only writer is /api/track.
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

const KEY = "events.json";
const MAX_EVENTS = 5000;

export const EVENT_TYPES: EventType[] = ["pageview", "quiz_start", "quiz_step", "quiz_submit"];

async function readAll(): Promise<SiteEvent[]> {
  return readJsonDoc<SiteEvent[]>(KEY, []);
}

export async function appendEvent(input: {
  type: EventType;
  path: string;
  locale: string;
  sessionId: string;
  meta?: Record<string, string | number>;
}): Promise<void> {
  const events = await readAll();
  events.push({
    id: randomUUID(),
    type: input.type,
    path: String(input.path).slice(0, 200),
    locale: input.locale === "fr" ? "fr" : "en",
    sessionId: String(input.sessionId).slice(0, 64),
    meta: input.meta,
    createdAt: new Date().toISOString(),
  });
  await writeJsonDoc(KEY, events.slice(-MAX_EVENTS));
}

export async function getEvents(): Promise<SiteEvent[]> {
  const events = await readAll();
  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
