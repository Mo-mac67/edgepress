import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getSettings, saveSettings } from "@/lib/cms-store";
import type { SiteSettings } from "@/lib/cms-types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getSettings() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { settings?: SiteSettings } | null;
  if (!body?.settings) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await saveSettings(body.settings);
  return NextResponse.json({ ok: true });
}
