import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getNav, saveNav } from "@/lib/cms-store";
import type { NavItem } from "@/lib/cms-types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ nav: await getNav() });
}

/** One item, sanitized. Depth caps at one sub-level (children of children dropped). */
function cleanItem(raw: NavItem, allowChildren: boolean): NavItem {
  const item: NavItem = {
    id: String(raw.id ?? "").slice(0, 20) || Math.random().toString(36).slice(2, 10),
    label: raw.label ?? { en: "", fr: "" },
    href: String(raw.href ?? "").slice(0, 500),
  };
  if (raw.external) item.external = true;
  if (allowChildren && Array.isArray(raw.children) && raw.children.length > 0) {
    item.children = raw.children.slice(0, 20).map((c) => cleanItem(c, false));
  }
  return item;
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.nav)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await saveNav((body.nav as NavItem[]).slice(0, 50).map((n) => cleanItem(n, true)));
  return NextResponse.json({ ok: true });
}
