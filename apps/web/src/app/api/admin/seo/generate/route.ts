import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getPages, savePage } from "@/lib/cms-store";
import { generateMeta } from "@/lib/seo";

/** AI-writes the SEO title + description for a page (needs ANTHROPIC_API_KEY). */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const locale = body.locale === "fr" ? "fr" : "en";
  const page = (await getPages()).find((p) => p.id === body.pageId);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const result = await generateMeta(page, locale);
  if ("error" in result) return NextResponse.json(result, { status: 501 });

  if (body.apply) {
    page.title = { ...page.title, [locale]: result.title };
    page.description = { ...page.description, [locale]: result.description };
    await savePage(page);
    await logAudit({ action: "seo_ai_meta", role: await getRole(), detail: `${page.slug || "home"} (${locale})` });
  }
  return NextResponse.json(result);
}
