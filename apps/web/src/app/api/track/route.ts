import { NextResponse } from "next/server";
import { appendEvent, EVENT_TYPES, type EventType } from "@/lib/events-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!rateLimit(`track:${clientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !EVENT_TYPES.includes(body.type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await appendEvent({
    type: body.type as EventType,
    path: String(body.path ?? "/"),
    locale: String(body.locale ?? "en"),
    sessionId: String(body.sessionId ?? "anon"),
    meta: typeof body.meta === "object" && body.meta ? body.meta : undefined,
  });
  return NextResponse.json({ ok: true });
}
