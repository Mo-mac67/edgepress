import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getNav, saveNav } from "@/lib/cms-store";
import type { NavItem } from "@/lib/cms-types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ nav: await getNav() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.nav)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await saveNav(body.nav as NavItem[]);
  return NextResponse.json({ ok: true });
}
