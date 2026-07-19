import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { blankPage, getPages, savePage } from "@/lib/cms-store";
import { getRole } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ pages: await getPages() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9/-]/g, "-").replace(/^\/+|\/+$/g, "");
  const title = String(body.title ?? "Untitled").trim().slice(0, 120);
  if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 422 });
  const pages = await getPages();
  if (pages.some((p) => p.slug === slug)) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  const rawHtml = typeof body.rawHtml === "string" && body.rawHtml.trim() ? String(body.rawHtml).slice(0, 900_000) : undefined;
  const page = blankPage(slug, title, rawHtml);
  await savePage(page);
  await logAudit({ action: "page_create", role: await getRole(), detail: slug });
  return NextResponse.json({ page }, { status: 201 });
}
