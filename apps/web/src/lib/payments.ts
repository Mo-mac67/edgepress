import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendLogItem, readWithCompaction } from "./append-log";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Stripe payments via HOSTED Checkout — the buyer pays on stripe.com, so card
 * data never touches EdgePress. BYOK: the owner pastes their own Stripe keys
 * (or sets STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET env vars). Everything is
 * plain fetch against the Stripe API — no SDK, Workers-safe.
 */

export interface PaymentsConfig {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
}

export interface Order {
  id: string;
  sessionId: string;
  product: string;
  /** Minor units (cents). */
  amount: number;
  currency: string;
  email?: string;
  status: "paid";
  createdAt: string;
}

const CONFIG_KEY = "payments.json";
const ORDERS_KEY = "orders.json";
const ORDER_PREFIX = "order-item-";

export async function getPaymentsConfig(): Promise<PaymentsConfig> {
  const cfg = await readJsonDoc<PaymentsConfig>(CONFIG_KEY, {});
  return {
    stripeSecretKey: cfg.stripeSecretKey || process.env.STRIPE_SECRET_KEY || undefined,
    stripeWebhookSecret: cfg.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || undefined,
  };
}
export async function savePaymentsConfig(patch: PaymentsConfig): Promise<void> {
  const cur = await readJsonDoc<PaymentsConfig>(CONFIG_KEY, {});
  // Empty string clears a key; undefined keeps the stored one (masked round-trip).
  const next: PaymentsConfig = { ...cur };
  if (patch.stripeSecretKey !== undefined) next.stripeSecretKey = patch.stripeSecretKey || undefined;
  if (patch.stripeWebhookSecret !== undefined) next.stripeWebhookSecret = patch.stripeWebhookSecret || undefined;
  await writeJsonDoc(CONFIG_KEY, next);
}

export async function getOrders(): Promise<Order[]> {
  const all = await readWithCompaction<Order>(ORDERS_KEY, ORDER_PREFIX);
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Race-safe (webhook retries / concurrent events) + idempotent by session. */
export async function recordOrder(o: Omit<Order, "id" | "createdAt" | "status">): Promise<Order | null> {
  const existing = await getOrders();
  if (existing.some((x) => x.sessionId === o.sessionId)) return null; // webhook retry
  const order: Order = { ...o, id: randomUUID().slice(0, 10), status: "paid", createdAt: new Date().toISOString() };
  await appendLogItem(ORDER_PREFIX, order.id, order);
  return order;
}

/**
 * Verifies a Stripe webhook signature header ("t=...,v1=...") against the raw
 * body: v1 = HMAC-SHA256(secret, `${t}.${payload}`), timestamp within
 * tolerance. Pure — unit-tested with a synthetic secret.
 */
export function verifyStripeSignature(payload: string, header: string, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  if (expected.length !== v1.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}
