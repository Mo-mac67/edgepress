import { NextResponse } from "next/server";
import { getPaymentsConfig, recordOrder, verifyStripeSignature } from "@/lib/payments";
import { dispatchWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Stripe webhook — records paid orders. Configure the endpoint in the Stripe
 *  dashboard pointing at /api/pay/webhook with the checkout.session.completed
 *  event, and paste the signing secret into Payments settings. */
export async function POST(request: Request) {
  const cfg = await getPaymentsConfig();
  if (!cfg.stripeWebhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const payload = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  if (!verifyStripeSignature(payload, sig, cfg.stripeWebhookSecret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed") {
    const s = event.data?.object ?? {};
    const order = await recordOrder({
      sessionId: String(s.id ?? ""),
      product: String(s.metadata?.product ?? "Product"),
      amount: Number(s.amount_total ?? 0),
      currency: String(s.currency ?? "usd"),
      email: s.customer_details?.email ? String(s.customer_details.email) : undefined,
    });
    if (order) await dispatchWebhook("order.paid", { order });
  }
  return NextResponse.json({ received: true });
}
