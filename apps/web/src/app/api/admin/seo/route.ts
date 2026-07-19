import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getSeo, saveSeo } from "@/lib/cms-store";
import { DEFAULT_SEO, type SeoSettings } from "@/lib/cms-types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    seo: await getSeo(),
    aiAvailable: !!process.env.ANTHROPIC_API_KEY,
    siteUrl: process.env.SITE_URL ?? "",
  });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { seo?: SeoSettings } | null;
  if (!body?.seo) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const current = await getSeo();
  const merged: SeoSettings = {
    ...DEFAULT_SEO,
    ...body.seo,
    business: { ...DEFAULT_SEO.business, ...body.seo.business },
    indexNowKey: current.indexNowKey, // key is system-managed
  };
  await saveSeo(merged);
  await logAudit({ action: "seo_save", role: await getRole() });
  return NextResponse.json({ ok: true });
}
