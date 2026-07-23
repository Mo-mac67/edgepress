import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getCampaigns, getSubscribers, unsubscribe } from "@/lib/newsletter-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [subscribers, campaigns] = await Promise.all([getSubscribers(), getCampaigns()]);
  return NextResponse.json({ subscribers, campaigns });
}

/** Remove a subscriber by email (admin-side). */
export async function DELETE(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = new URL(request.url).searchParams.get("email") ?? "";
  return NextResponse.json({ ok: await unsubscribe(email) });
}
