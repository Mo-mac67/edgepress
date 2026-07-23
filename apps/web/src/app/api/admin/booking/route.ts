import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { cancelBooking, getBookingConfig, getBookings, saveBookingConfig } from "@/lib/booking-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [config, bookings] = await Promise.all([getBookingConfig(), getBookings()]);
  return NextResponse.json({ config, bookings });
}

/** Update availability config. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const config = await saveBookingConfig({ enabled: body.enabled, slotMinutes: body.slotMinutes, days: body.days });
  await logAudit({ action: "booking_config", role: await getRole(), detail: config.enabled ? "enabled" : "disabled" });
  return NextResponse.json({ config });
}

/** Cancel a booking: DELETE ?id= */
export async function DELETE(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const ok = await cancelBooking(id);
  if (ok) await logAudit({ action: "booking_cancel", role: await getRole(), detail: id });
  return NextResponse.json({ ok });
}
