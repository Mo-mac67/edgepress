import { NextResponse } from "next/server";
import { getPages } from "@/lib/cms-store";
import { getPaymentsConfig } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Creates a Stripe HOSTED Checkout session for a payment block. Price and
 * product are read from the stored page server-side — the client only sends
 * ids, so amounts can't be tampered with. The buyer pays on stripe.com.
 */
export async function POST(request: Request) {
  if (!rateLimit(`pay:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again shortly" }, { status: 429 });
  }
  const cfg = await getPaymentsConfig();
  if (!cfg.stripeSecretKey) return NextResponse.json({ error: "Payments are not configured on this site" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const pageId = String(body.pageId ?? "");
  const blockId = String(body.blockId ?? "");
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 5) : "en";

  const page = (await getPages()).find((p) => p.id === pageId);
  const block = page?.blocks.find((b) => b.id === blockId && b.type === "payment");
  if (!page || !block) return NextResponse.json({ error: "Unknown payment block" }, { status: 404 });

  const data = block.data as { product?: string; amount?: string; currency?: string };
  const amount = Math.round(Number(String(data.amount ?? "").replace(",", ".")) * 100);
  const currency = ["usd", "cad", "eur", "gbp"].includes(String(data.currency)) ? String(data.currency) : "usd";
  const product = String(data.product ?? "Product").slice(0, 120);
  if (!Number.isFinite(amount) || amount < 50) return NextResponse.json({ error: "This payment block has an invalid price" }, { status: 422 });

  const site = process.env.SITE_URL ?? new URL(request.url).origin;
  const back = `${site}/${locale}/${page.slug}`;
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][product_data][name]": product,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][quantity]": "1",
    success_url: `${back}?paid=1`,
    cancel_url: back,
    "metadata[product]": product,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const session = await res.json().catch(() => null);
  if (!res.ok || !session?.url) {
    console.error("[pay] stripe session failed", res.status, session?.error?.message);
    return NextResponse.json({ error: "Couldn't start the checkout — try again" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
