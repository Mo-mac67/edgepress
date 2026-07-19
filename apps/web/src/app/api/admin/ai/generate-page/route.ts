import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getPages, savePage, blankPage } from "@/lib/cms-store";
import { generatePageBlocks } from "@/lib/ai/features";
import type { Page } from "@/lib/cms-types";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/**
 * Content Studio — prompt → page blocks. Either fills an existing page
 * (pageId) or creates a new DRAFT page. AI output is never auto-published.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();
  const locale = body.locale === "fr" ? "fr" : "en";
  if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 422 });

  let blocks;
  try {
    blocks = await generatePageBlocks(prompt, locale);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed" }, { status: 502 });
  }
  if (blocks.length === 0) return NextResponse.json({ error: "The model returned no usable blocks — try rephrasing." }, { status: 502 });

  // Return blocks only (for in-editor insertion).
  if (body.mode === "blocks") {
    return NextResponse.json({ blocks });
  }

  // Create a new draft page.
  const pages = await getPages();
  const title = prompt.slice(0, 60);
  let slug = slugify(title) || `page-${randomUUID().slice(0, 4)}`;
  while (pages.some((p) => p.slug === slug)) slug = `${slug}-2`;
  const page: Page = { ...blankPage(slug, title), status: "draft", blocks };
  page.title = { en: locale === "en" ? title : "", fr: locale === "fr" ? title : "" };
  await savePage(page);
  await logAudit({ action: "ai_generate_page", role: await getRole(), detail: slug });
  return NextResponse.json({ page });
}
