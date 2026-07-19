import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getTheme, saveTheme } from "@/lib/cms-store";
import type { ThemeSettings } from "@/lib/cms-types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ theme: await getTheme() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { theme?: ThemeSettings } | null;
  if (!body?.theme?.colors) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await saveTheme(body.theme);
  await logAudit({ action: "theme_save", role: await getRole(), detail: body.theme.preset });
  return NextResponse.json({ ok: true });
}
