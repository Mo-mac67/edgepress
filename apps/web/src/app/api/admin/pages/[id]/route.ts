import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deletePage, getPages, savePage, snapshotRevision } from "@/lib/cms-store";
import { pingIndexNow } from "@/lib/seo";
import type { Page } from "@/lib/cms-types";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const pages = await getPages();
  const existing = pages.find((p) => p.id === id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as Partial<Page> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const merged: Page = {
    ...existing,
    title: body.title ?? existing.title,
    description: body.description ?? existing.description,
    // Partial updates (e.g. restore, schedule) must not flip publish state.
    status: body.status === "draft" ? "draft" : body.status === "published" ? "published" : existing.status,
    blocks: Array.isArray(body.blocks) ? body.blocks : existing.blocks,
    mode: body.mode === "html" ? "html" : body.mode === "blocks" ? "blocks" : existing.mode,
    rawHtml: typeof body.rawHtml === "string" ? body.rawHtml.slice(0, 900_000) : existing.rawHtml,
    hideChrome: typeof body.hideChrome === "boolean" ? body.hideChrome : existing.hideChrome,
    // System pages keep their slug; custom pages may be re-slugged.
    slug: existing.system ? existing.slug : (body.slug ?? existing.slug),
    // Scheduled publishing (ISO datetime or null to clear).
    publishAt: body.publishAt === null ? undefined : typeof body.publishAt === "string" && body.publishAt ? body.publishAt : existing.publishAt,
  };
  // Restore from Trash via trashed:false.
  if (body.trashed === false) {
    merged.trashed = undefined;
    merged.trashedAt = undefined;
  }
  // A/B headline test config.
  if (body.ab && Array.isArray(body.ab.headlines)) {
    const headlines = body.ab.headlines.map((h: unknown) => String(h).slice(0, 200)).filter((h: string) => h.trim()).slice(0, 6);
    merged.ab = headlines.length ? { headlines } : undefined;
  }
  // Per-page SEO overrides (og image, keywords, noindex).
  if (body.seo && typeof body.seo === "object") {
    merged.seo = {
      ogImage: typeof body.seo.ogImage === "string" ? body.seo.ogImage : existing.seo?.ogImage,
      keywords: typeof body.seo.keywords === "string" ? body.seo.keywords : existing.seo?.keywords,
      noindex: typeof body.seo.noindex === "boolean" ? body.seo.noindex : existing.seo?.noindex,
    };
  }
  await snapshotRevision(id); // version history: capture the pre-save state
  await savePage(merged);
  await logAudit({ action: "page_save", role: await getRole(), detail: merged.slug || "home" });
  // Instant indexing: notify search engines when a page goes (or stays) live.
  if (merged.status === "published") await pingIndexNow(merged.slug);
  return NextResponse.json({ page: merged });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  // Default: move to Trash (restorable). ?force=1 deletes forever.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const ok = await deletePage(id, force);
  if (ok) await logAudit({ action: force ? "page_delete_forever" : "page_trash", role: await getRole(), detail: id });
  return NextResponse.json({ ok });
}
