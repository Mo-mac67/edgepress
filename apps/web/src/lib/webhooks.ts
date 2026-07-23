import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Outbound webhooks. Register a URL + the events it wants; EdgePress POSTs a
 * signed JSON payload whenever a matching event fires (content changes, leads,
 * etc.). Signature: HMAC-SHA256 of the raw body, header `x-edgepress-signature`.
 */

export const WEBHOOK_EVENTS = [
  "entry.created",
  "entry.updated",
  "entry.deleted",
  "entry.published",
  "lead.created",
  "form.submitted",
  "order.paid",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
  lastStatus?: number;
  lastFiredAt?: string;
}

const KEY = "webhooks.json";

export async function listWebhooks(): Promise<Webhook[]> {
  return readJsonDoc<Webhook[]>(KEY, []);
}
export async function addWebhook(url: string, events: string[]): Promise<Webhook | { error: string }> {
  try {
    new URL(url);
  } catch {
    return { error: "Invalid URL" };
  }
  const valid = events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (valid.length === 0) return { error: "Select at least one event" };
  const hooks = await listWebhooks();
  const hook: Webhook = {
    id: randomUUID().slice(0, 8),
    url,
    events: valid,
    secret: "whsec_" + randomBytes(16).toString("hex"),
    active: true,
    createdAt: new Date().toISOString(),
  };
  hooks.push(hook);
  await writeJsonDoc(KEY, hooks);
  return hook;
}
export async function removeWebhook(id: string): Promise<boolean> {
  const hooks = await listWebhooks();
  const next = hooks.filter((h) => h.id !== id);
  if (next.length === hooks.length) return false;
  await writeJsonDoc(KEY, next);
  return true;
}

async function persistResult(id: string, status: number): Promise<void> {
  const hooks = await listWebhooks();
  const h = hooks.find((x) => x.id === id);
  if (!h) return;
  h.lastStatus = status;
  h.lastFiredAt = new Date().toISOString();
  try {
    await writeJsonDoc(KEY, hooks);
  } catch {
    /* best effort */
  }
}

/** Deliver `event` to every subscribed, active webhook. Fire-and-forget:
 *  failures are recorded but never throw into the caller's request path. */
export async function dispatchWebhook(event: WebhookEvent, payload: unknown): Promise<void> {
  const hooks = (await listWebhooks()).filter((h) => h.active && h.events.includes(event));
  if (hooks.length === 0) return;
  const body = JSON.stringify({ event, at: new Date().toISOString(), data: payload });
  await Promise.all(
    hooks.map(async (h) => {
      try {
        const sig = createHmac("sha256", h.secret).update(body).digest("hex");
        const res = await fetch(h.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-edgepress-event": event, "x-edgepress-signature": sig },
          body,
          signal: AbortSignal.timeout(5000), // don't let a slow endpoint stall the request
        });
        await persistResult(h.id, res.status);
      } catch {
        await persistResult(h.id, 0);
      }
    }),
  );
}

/** Send a sample delivery so the owner can confirm their endpoint works. */
export async function testWebhook(id: string): Promise<{ ok: boolean; status?: number }> {
  const hook = (await listWebhooks()).find((h) => h.id === id);
  if (!hook) return { ok: false };
  const body = JSON.stringify({ event: "test", at: new Date().toISOString(), data: { message: "EdgePress test event" } });
  try {
    const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
    const res = await fetch(hook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-edgepress-event": "test", "x-edgepress-signature": sig },
      body,
      signal: AbortSignal.timeout(5000),
    });
    await persistResult(id, res.status);
    return { ok: res.ok, status: res.status };
  } catch {
    await persistResult(id, 0);
    return { ok: false };
  }
}
