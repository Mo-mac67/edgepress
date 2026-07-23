import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getOrders, getPaymentsConfig, savePaymentsConfig } from "@/lib/payments";

/** Config is masked — keys are never echoed back, only whether they're set. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [cfg, orders] = await Promise.all([getPaymentsConfig(), getOrders()]);
  return NextResponse.json({
    config: { stripeSecretKey: cfg.stripeSecretKey ? "set" : "", stripeWebhookSecret: cfg.stripeWebhookSecret ? "set" : "" },
    orders,
  });
}

/** Owner only — payment keys are the most sensitive config on the site. */
export async function POST(request: Request) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const clean = (v: unknown) => {
    if (typeof v !== "string") return undefined; // untouched
    const s = v.trim();
    return s === "set" ? undefined : s; // "set" = masked round-trip, keep stored
  };
  await savePaymentsConfig({ stripeSecretKey: clean(body.stripeSecretKey), stripeWebhookSecret: clean(body.stripeWebhookSecret) });
  await logAudit({ action: "payments_config", role: "super", detail: "Stripe keys updated" });
  return NextResponse.json({ ok: true });
}
