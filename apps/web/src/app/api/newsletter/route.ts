import { NextResponse } from "next/server";
import { subscribe } from "@/lib/newsletter-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public newsletter signup. */
export async function POST(request: Request) {
  if (!rateLimit(`nl:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute" }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (body._hp) return NextResponse.json({ ok: true }); // honeypot
  const result = await subscribe(body.email, typeof body.locale === "string" ? body.locale.slice(0, 5) : undefined);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
