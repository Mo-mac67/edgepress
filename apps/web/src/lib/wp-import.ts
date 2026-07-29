import "server-only";
import { randomUUID } from "node:crypto";
import { mapDate, mapStatus, parseWxr, planImport, rewriteMediaUrls, type WxrItem, type WxrPlan } from "@edgepress/core/wxr";
import { getPages, getPosts, savePage, savePost, addMedia } from "./cms-store";
import { saveRedirect } from "./redirects-store";
import { putMedia } from "./media-r2";
import { defaultLocale } from "@/i18n/config";

/**
 * WordPress import. Two deliberately separate phases:
 *
 *  1. CONTENT — parse the WXR and write pages/posts/redirects. Storage-only, so
 *     it's fast and can't be defeated by a dead image host.
 *  2. MEDIA — re-download attachments into your own storage, in small batches.
 *     Each file is an outbound request, and Workers caps subrequests per
 *     invocation, so this has to be resumable rather than one big loop.
 *
 * Both phases skip what already exists, so re-running is safe and a half-done
 * import can be finished rather than restarted.
 */

const MEDIA_PREFIX = "wp-import";

export interface ImportSummary {
  pages: { created: number; replaced: number; skipped: number };
  posts: { created: number; replaced: number; skipped: number };
  redirects: { created: number; skipped: number };
  /** Attachments found, for the media phase that follows. */
  mediaPending: number;
  notImported: { reason: string; count: number }[];
  /**
   * Slugs that already existed. Every WordPress site has an /about, and so does
   * a fresh EdgePress install — without surfacing this, an import would look
   * like it worked while the owner's real pages were silently dropped.
   */
  collisions: { pages: string[]; posts: string[] };
}

export interface ImportOptions {
  /** Overwrite content whose slug already exists (keeps the existing id, so it
   *  updates in place instead of creating a duplicate). Default false. */
  replaceExisting?: boolean;
}

/** What the file contains, without writing anything. */
export function inspectWxr(xml: string): WxrPlan & { siteUrl?: string } {
  const parsed = parseWxr(xml);
  return { ...planImport(parsed), siteUrl: parsed.siteUrl };
}

/** WordPress exports are single-language; put the text in every active locale so
 *  nothing renders blank, and let the owner translate from there. */
const localized = (text: string) => {
  const out: Record<string, string> = { en: text, fr: text };
  out[defaultLocale] = text;
  return out as Record<string, string> & { en: string; fr: string };
};

/** Strip HTML down to a plain sentence or two, for a meta description. */
function toDescription(html: string, limit = 160): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Phase 1. Writes content and redirects; leaves media alone.
 * `xml` is the raw WXR file contents.
 */
export async function importWxrContent(xml: string, options: ImportOptions = {}): Promise<ImportSummary> {
  const plan = inspectWxr(xml);
  const replace = options.replaceExisting === true;

  // Keep the ids: savePage/savePost match on id, so reusing one updates in place
  // while a fresh uuid would leave two pages fighting over the same slug.
  const pageIdBySlug = new Map((await getPages()).map((p) => [p.slug, p.id]));
  const postIdBySlug = new Map((await getPosts()).map((p) => [p.slug, p.id]));

  const summary: ImportSummary = {
    pages: { created: 0, replaced: 0, skipped: 0 },
    posts: { created: 0, replaced: 0, skipped: 0 },
    redirects: { created: 0, skipped: 0 },
    mediaPending: plan.attachments.length,
    notImported: plan.skipped,
    collisions: { pages: [], posts: [] },
  };

  for (const it of plan.pages) {
    const existingId = pageIdBySlug.get(it.slug);
    if (existingId && !replace) {
      summary.pages.skipped++;
      summary.collisions.pages.push(it.slug);
      continue;
    }
    await savePage({
      id: existingId ?? randomUUID(),
      slug: it.slug,
      status: mapStatus(it.status),
      title: localized(it.title || it.slug),
      description: localized(toDescription(it.excerpt || it.content)),
      blocks: [],
      // Imported WordPress markup is kept as-is rather than guessed into
      // blocks: the point of a migration is that the page still looks right.
      mode: "html",
      rawHtml: it.content,
      updatedAt: new Date().toISOString(),
    } as never);
    if (existingId) summary.pages.replaced++; else summary.pages.created++;
    pageIdBySlug.set(it.slug, existingId ?? "");
  }

  for (const it of plan.posts) {
    const existingPostId = postIdBySlug.get(it.slug);
    if (existingPostId && !replace) {
      summary.posts.skipped++;
      summary.collisions.posts.push(it.slug);
      continue;
    }
    await savePost({
      id: existingPostId ?? randomUUID(),
      slug: it.slug,
      status: mapStatus(it.status),
      title: localized(it.title || it.slug),
      excerpt: localized(toDescription(it.excerpt || it.content, 200)),
      cover: "",
      body: localized(it.content),
      date: mapDate(it.date),
      author: it.author ?? "",
      categories: it.categories,
      tags: it.tags,
    } as never);
    if (existingPostId) summary.posts.replaced++; else summary.posts.created++;
    postIdBySlug.set(it.slug, existingPostId ?? "");
  }

  for (const r of plan.redirects) {
    const res = await saveRedirect({ from: r.from, to: r.to, code: 301 });
    if ("error" in res) summary.redirects.skipped++;
    else summary.redirects.created++;
  }

  return summary;
}

export interface MediaBatchResult {
  imported: number;
  failed: { url: string; reason: string }[];
  /** How many attachments still have no local copy. */
  remaining: number;
  /** Old URL → new URL, for rewriting content. */
  urlMap: Record<string, string>;
}

/** A storage key for an attachment, kept stable so re-runs are idempotent. */
function mediaKeyFor(url: string): string {
  const name = (() => {
    try {
      return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "file");
    } catch {
      return "file";
    }
  })();
  // Keep the WordPress folder shape out of it but keep the name recognisable.
  return `${MEDIA_PREFIX}/${name.replace(/[^\w.-]+/g, "-")}`;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", pdf: "application/pdf",
};

/**
 * Phase 2. Re-downloads up to `limit` attachments into local storage.
 * Call repeatedly until `remaining` is 0 — that's what keeps a large library
 * inside the per-invocation subrequest budget on Workers.
 */
export async function importWxrMediaBatch(xml: string, limit = 5, alreadyDone: string[] = []): Promise<MediaBatchResult> {
  const { attachments } = inspectWxr(xml);
  const done = new Set(alreadyDone);
  const todo = attachments.filter((a) => a.attachmentUrl && !done.has(a.attachmentUrl));

  const result: MediaBatchResult = { imported: 0, failed: [], remaining: 0, urlMap: {} };

  for (const att of todo.slice(0, limit)) {
    const url = att.attachmentUrl!;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { result.failed.push({ url, reason: `HTTP ${res.status}` }); continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const key = mediaKeyFor(url);
      const ext = key.split(".").pop()?.toLowerCase() ?? "";
      const type = res.headers.get("content-type")?.split(";")[0] || CONTENT_TYPES[ext] || "application/octet-stream";
      await putMedia(key, bytes, type);
      await addMedia({
        id: randomUUID(),
        key,
        url: `/api/media/${key}`,
        filename: key.split("/").pop() ?? key,
        size: bytes.byteLength,
        kind: type.startsWith("image/") ? "image" : undefined,
        alt: att.title || "",
        uploadedAt: new Date().toISOString(),
      } as never);
      result.urlMap[url] = `/api/media/${key}`;
      result.imported++;
    } catch (e) {
      result.failed.push({ url, reason: e instanceof Error ? e.message : "download failed" });
    }
  }

  result.remaining = Math.max(0, todo.length - Math.min(limit, todo.length));
  return result;
}

/**
 * Point imported content at the local copies. Run after a media batch, using
 * the map it returned — imported HTML still references the old domain until
 * this happens, which would leave the new site hotlinking the old one.
 */
export async function rewriteImportedMedia(urlMap: Record<string, string>): Promise<{ pages: number; posts: number }> {
  if (Object.keys(urlMap).length === 0) return { pages: 0, posts: 0 };
  let pages = 0;
  let posts = 0;

  for (const page of await getPages()) {
    if (page.mode !== "html" || !page.rawHtml) continue;
    const next = rewriteMediaUrls(page.rawHtml, urlMap);
    if (next === page.rawHtml) continue;
    await savePage({ ...page, rawHtml: next } as never);
    pages++;
  }

  for (const post of await getPosts()) {
    const body = post.body as Record<string, string>;
    let changed = false;
    const nextBody: Record<string, string> = {};
    for (const [locale, html] of Object.entries(body ?? {})) {
      const next = typeof html === "string" ? rewriteMediaUrls(html, urlMap) : html;
      if (next !== html) changed = true;
      nextBody[locale] = next;
    }
    if (!changed) continue;
    await savePost({ ...post, body: nextBody } as never);
    posts++;
  }

  return { pages, posts };
}
