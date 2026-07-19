import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getPages, savePage } from "@/lib/cms-store";
import { translatePage } from "@/lib/ai/features";
import { locales } from "@/i18n/config";

/** Translate a page's content from one locale into another (additive — the
 *  source locale is untouched; the page keeps its current status). */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const from = String(body.from ?? "en");
  const to = String(body.to ?? "fr");
  if (!locales.includes(from as never) || !locales.includes(to as never) || from === to) {
    return NextResponse.json({ error: "Invalid locales" }, { status: 422 });
  }
  const page = (await getPages()).find((p) => p.id === body.pageId);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  try {
    const translated = await translatePage(page, from, to);
    await savePage(translated);
    await logAudit({ action: "ai_translate", role: await getRole(), detail: `${page.slug || "home"} ${from}→${to}` });
    return NextResponse.json({ page: translated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Translation failed" }, { status: 502 });
  }
}
