import { NextResponse } from "next/server";
import { recordImpression } from "@/lib/ab-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public: record an A/B headline impression. */
export async function POST(request: Request) {
  if (!rateLimit(`ab:${clientIp(request)}`, 60, 60_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug ?? "").slice(0, 200);
  const variant = Number(body.variant);
  if (Number.isInteger(variant)) await recordImpression(slug, variant);
  return NextResponse.json({ ok: true });
}
