import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { importWxrContent, importWxrMediaBatch, inspectWxr, rewriteImportedMedia } from "@/lib/wp-import";

export const dynamic = "force-dynamic";

/** Importing rewrites the site's content, so owner-only. */
async function ownerOnly() {
  return (await getRole()) === "super";
}

/** WordPress exports of a big site get large; refuse politely rather than OOM. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Import a WordPress export (Tools → Export → All content).
 *
 *   action "inspect" — parse only, report what would happen. Nothing is written.
 *   action "content" — create pages, posts and 301 redirects.
 *   action "media"   — re-download attachments in batches (repeat until
 *                      remaining is 0), then rewrite content to point at them.
 *
 * The phases are separate because media means one outbound request per file and
 * Workers caps subrequests per invocation — a single-shot import would die
 * halfway through a real photo library.
 */
export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the export as multipart form data" }, { status: 400 });

  const file = form.get("file");
  const action = String(form.get("action") ?? "inspect");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That export is ${(file.size / 1048576).toFixed(1)} MB; the limit is 20 MB. Export in parts (Tools → Export → Posts, then Pages).` },
      { status: 413 },
    );
  }

  const xml = await file.text();
  if (!/<rss[\s>]/i.test(xml) || !/wordpress\.org\/export/i.test(xml)) {
    return NextResponse.json(
      { error: "That doesn't look like a WordPress export. Use Tools → Export in WP-Admin and upload the .xml file." },
      { status: 422 },
    );
  }

  if (action === "inspect") {
    const plan = inspectWxr(xml);
    return NextResponse.json({
      siteUrl: plan.siteUrl,
      pages: plan.pages.length,
      posts: plan.posts.length,
      attachments: plan.attachments.length,
      redirects: plan.redirects.length,
      notImported: plan.skipped,
    });
  }

  if (action === "content") {
    // Opt-in only: the default run keeps whatever the site already has, and the
    // admin re-submits with replace=1 after being shown which slugs clashed.
    const replaceExisting = String(form.get("replace") ?? "") === "1";
    const summary = await importWxrContent(xml, { replaceExisting });
    await logAudit({
      action: "wp_import_content",
      role: "super",
      detail: `${summary.pages.created} created, ${summary.pages.replaced} replaced pages; ${summary.posts.created} posts; ${summary.redirects.created} redirects`,
    });
    return NextResponse.json({ ok: true, ...summary });
  }

  if (action === "media") {
    const limit = Math.min(Number(form.get("limit") ?? 5) || 5, 10);
    const done = String(form.get("done") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    const batch = await importWxrMediaBatch(xml, limit, done);
    const rewritten = await rewriteImportedMedia(batch.urlMap);
    await logAudit({ action: "wp_import_media", role: "super", detail: `${batch.imported} files` });
    return NextResponse.json({ ok: true, ...batch, rewritten });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
