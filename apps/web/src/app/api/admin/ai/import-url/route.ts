import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { blankPage, getPages, savePage } from "@/lib/cms-store";
import { generatePageBlocks } from "@/lib/ai/features";
import type { Page } from "@/lib/cms-types";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Importer v2 — fetch a public URL, extract its text, and let the AI rebuild
 *  it as EdgePress blocks (a draft page). Smarter than the heuristic importer. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const locale = body.locale === "fr" ? "fr" : "en";
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "Enter a valid URL" }, { status: 422 });

  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (EdgePress importer)" } });
    if (!res.ok) return NextResponse.json({ error: `Could not fetch the page (${res.status})` }, { status: 502 });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Could not reach that URL" }, { status: 502 });
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)/i);
  const pageTitle = (titleMatch?.[1] ?? "Imported page").trim().slice(0, 80);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
  if (text.length < 60) return NextResponse.json({ error: "That page had too little text to import." }, { status: 422 });

  try {
    const blocks = await generatePageBlocks(`Recreate this web page as a clean EdgePress page, keeping its meaning and structure. Page title: "${pageTitle}". Content:\n${text}`, locale);
    if (blocks.length === 0) return NextResponse.json({ error: "The model returned no usable blocks." }, { status: 502 });
    const pages = await getPages();
    let slug = slugify(pageTitle) || `import-${randomUUID().slice(0, 4)}`;
    while (pages.some((p) => p.slug === slug)) slug = `${slug}-2`;
    const page: Page = { ...blankPage(slug, pageTitle), status: "draft", blocks, title: { en: "", fr: "", [locale]: pageTitle } as Page["title"] };
    await savePage(page);
    await logAudit({ action: "ai_import_url", role: await getRole(), detail: url.slice(0, 80) });
    return NextResponse.json({ page });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 502 });
  }
}
