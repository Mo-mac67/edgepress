import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady, describeImage } from "@/lib/ai/engine";
import { generatePageBlocks } from "@/lib/ai/features";
import { blankPage, getPages, savePage } from "@/lib/cms-store";

/** Import a page design from a screenshot: a vision model extracts the layout
 *  and copy, then the block generator rebuilds it as an editable draft page.
 *  Approximate by nature — meant as a fast starting point, not a pixel copy. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a screenshot image" }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "Image too large (max 6MB)" }, { status: 413 });
  const locale = String(form?.get("locale") ?? "en");

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const description = await describeImage(
      bytes,
      "This is a screenshot of a web page. Describe it section by section, top to bottom: the headline and subtitle text, navigation items, feature/card sections with their titles, testimonials, calls to action, and footer. Quote the visible text where possible.",
      600,
    );
    if (description.trim().length < 40) return NextResponse.json({ error: "Couldn't read enough from that screenshot" }, { status: 422 });

    const blocks = await generatePageBlocks(`Rebuild this web page from its description. Keep the same sections, order and copy:\n${description}`, locale);
    const pages = await getPages();
    let slug = "imported-screenshot";
    let n = 2;
    while (pages.some((p) => p.slug === slug)) slug = `imported-screenshot-${n++}`;
    const page = blankPage(slug, "Imported from screenshot");
    page.blocks = blocks;
    await savePage(page);
    await logAudit({ action: "page_import_screenshot", role: await getRole(), detail: slug });
    return NextResponse.json({ page }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 500 });
  }
}
