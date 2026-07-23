import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { appendLogItem, readWithCompaction } from "./append-log";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Newsletter — subscriber list (race-safe append-log) + campaign history.
 * Sending goes through Resend's batch endpoint in chunks; without an API key
 * everything logs instead of sending, so the feature works key-free.
 */

export interface Subscriber {
  id: string;
  email: string;
  locale?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  subject: string;
  sentAt: string;
  recipients: number;
  /** false = logged only (no RESEND_API_KEY). */
  delivered: boolean;
}

const SUBS_KEY = "newsletter.json";
const SUB_PREFIX = "nl-sub-item-";
const CAMPAIGNS_KEY = "newsletter-campaigns.json";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** De-duplicated (by email, first subscription wins), newest first. */
export async function getSubscribers(): Promise<Subscriber[]> {
  const all = await readWithCompaction<Subscriber>(SUBS_KEY, SUB_PREFIX);
  const seen = new Set<string>();
  const out: Subscriber[] = [];
  for (const s of [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = s.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.reverse();
}

export async function subscribe(emailRaw: string, locale?: string): Promise<Subscriber | { error: string }> {
  const email = String(emailRaw ?? "").trim().toLowerCase().slice(0, 120);
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
  const existing = (await getSubscribers()).find((s) => s.email === email);
  if (existing) return existing; // idempotent — no duplicates, no error leak
  const sub: Subscriber = { id: randomUUID().slice(0, 10), email, ...(locale ? { locale } : {}), createdAt: new Date().toISOString() };
  await appendLogItem(SUB_PREFIX, sub.id, sub);
  return sub;
}

export async function unsubscribe(email: string): Promise<boolean> {
  const all = await getSubscribers();
  const next = all.filter((s) => s.email !== String(email).trim().toLowerCase());
  if (next.length === all.length) return false;
  await writeJsonDoc(SUBS_KEY, next);
  return true;
}

/** Unsubscribe links are signed so nobody can remove someone else's address. */
export function unsubscribeToken(email: string): string {
  const secret = process.env.ADMIN_SECRET ?? "edgepress-dev";
  return createHmac("sha256", secret).update(`unsub:${email.toLowerCase()}`).digest("hex").slice(0, 20);
}
export function isValidUnsubscribe(email: string, token?: string): boolean {
  return !!token && token === unsubscribeToken(email);
}

export async function getCampaigns(): Promise<Campaign[]> {
  return readJsonDoc<Campaign[]>(CAMPAIGNS_KEY, []);
}

export async function recordCampaign(c: Omit<Campaign, "id" | "sentAt">): Promise<Campaign> {
  const list = await getCampaigns();
  const full: Campaign = { ...c, id: randomUUID().slice(0, 8), sentAt: new Date().toISOString() };
  list.unshift(full);
  await writeJsonDoc(CAMPAIGNS_KEY, list.slice(0, 100));
  return full;
}
