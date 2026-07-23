import { NextResponse } from "next/server";
import { createBooking, freeSlots } from "@/lib/booking-store";
import { sendNotification } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Free slots for a date: GET /api/booking?date=YYYY-MM-DD */
export async function GET(request: Request) {
  if (!rateLimit(`bookingq:${clientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ slots: [] }, { status: 429 });
  }
  const date = new URL(request.url).searchParams.get("date") ?? "";
  return NextResponse.json({ slots: await freeSlots(date) });
}

/** Book a slot (public — rate-limited + honeypot). */
export async function POST(request: Request) {
  if (!rateLimit(`booking:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute" }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (body._hp) return NextResponse.json({ ok: true });
  const result = await createBooking({ date: body.date, time: body.time, name: body.name, email: body.email, note: body.note });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  const to = process.env.LEAD_NOTIFY_TO;
  if (to) await sendNotification(to, `New booking: ${result.slot}`, `${result.name} <${result.email}>\n${result.slot}\n${result.note ?? ""}`);
  return NextResponse.json({ ok: true, booking: { slot: result.slot } }, { status: 201 });
}
