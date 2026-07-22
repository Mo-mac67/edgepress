import "server-only";
import { generatePageBlocks } from "./ai/features";
import { blankPage, getPages, savePage } from "./cms-store";
import { readJsonDoc, writeJsonDoc } from "./storage";
import type { Page } from "./cms-types";

// Slugs that failed to import (thin/broken pages), persisted per run so
// repeated batches don't retry them forever. Cleared when a new import starts
// from a different origin.
const SKIP_KEY = "site-import-skip.json";
type SkipDoc = { origin: string; slugs: string[] };

/**
 * Whole-site importer: reads a site's sitemap.xml and rebuilds every page as an
 * editable EdgePress draft (via the AI block generator). Designed to be called
 * repeatedly — each call imports a small batch (Workers request limits) and
 * skips slugs that already exist, so the client just loops until done.
 */

const BATCH = 3; // pages per call: each import = 1 fetch + 1 AI call (~10s)
const MAX_URLS = 60;

/** Collect page URLs from /sitemap.xml (follows one level of sitemap-index). */
export async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const locs = async (xmlUrl: string): Promise<{ pages: string[]; sitemaps: string[] }> => {
    const res = await fetch(xmlUrl, { headers: { "User-Agent": "Mozilla/5.0 (EdgePress importer)" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`sitemap fetch failed (${res.status})`);
    const xml = await res.text();
    const all = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    const isIndex = /<sitemapindex/i.test(xml);
    return isIndex ? { pages: [], sitemaps: all } : { pages: all, sitemaps: [] };
  };

  const first = await locs(`${origin}/sitemap.xml`);
  let pages = first.pages;
  for (const child of first.sitemaps.slice(0, 3)) {
    try {
      pages = pages.concat((await locs(child)).pages);
    } catch {
      /* skip a broken child sitemap */
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of pages) {
    try {
      const parsed = new URL(u);
      if (parsed.origin !== origin) continue; // same site only
      if (/\.(pdf|jpe?g|png|webp|gif|svg|mp4|zip|xml)$/i.test(parsed.pathname)) continue;
      const key = parsed.pathname.replace(/\/+$/, "") || "/";
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(parsed.href);
    } catch {
      /* ignore malformed */
    }
  }
  return out.slice(0, MAX_URLS);
}

/** Slug for an imported URL: the path, minus a leading 2-letter locale segment
 *  (so /en/about and /fr/about collapse to one "about" page). "" → home. */
export function slugForUrl(url: string): string {
  const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] && /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0])) parts.shift();
  const slug = parts.join("-").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "imported-home";
}

/** Fetch one URL and rebuild it as a draft page. Returns null when the page has
 *  too little text (nav-only pages, redirects…). */
export async function importUrlAsDraft(url: string, slug: string, locale: string): Promise<Page | null> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (EdgePress importer)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const html = await res.text();
  const pageTitle = (html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? slug).trim().slice(0, 80);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
  if (text.length < 60) return null;

  const blocks = await generatePageBlocks(`Recreate this web page as a clean EdgePress page, keeping its meaning and structure. Page title: "${pageTitle}". Content:\n${text}`, locale);
  if (blocks.length === 0) return null;
  const page: Page = { ...blankPage(slug, pageTitle), status: "draft", blocks, title: { en: "", fr: "", [locale]: pageTitle } as Page["title"] };
  await savePage(page);
  return page;
}

export interface SiteImportProgress {
  total: number;
  imported: number;
  skipped: number;
  remaining: number;
  done: boolean;
  batch: { slug: string; title: string }[];
}

/** One batch of the whole-site import. Resumable: slugs that already exist are
 *  skipped, and thin/broken pages land on a persisted skip-list so repeated
 *  batches never retry them. */
export async function importSiteBatch(baseUrl: string, locale: string): Promise<SiteImportProgress> {
  const origin = new URL(baseUrl).origin;
  const urls = await fetchSitemapUrls(baseUrl);

  let skip = await readJsonDoc<SkipDoc>(SKIP_KEY, { origin, slugs: [] });
  if (skip.origin !== origin) skip = { origin, slugs: [] }; // new site → fresh list
  const skipSet = new Set(skip.slugs);

  const existing = new Set((await getPages()).map((p) => p.slug));
  // One URL per target slug (localized sitemaps list /en/x and /fr/x — same page).
  const bySlug = new Map<string, string>();
  for (const u of urls) {
    const s = slugForUrl(u);
    if (!existing.has(s) && !skipSet.has(s) && !bySlug.has(s)) bySlug.set(s, u);
  }
  const pending = [...bySlug.values()];

  const batch: { slug: string; title: string }[] = [];
  let skipped = 0;
  for (const url of pending.slice(0, BATCH)) {
    const slug = slugForUrl(url);
    try {
      const page = await importUrlAsDraft(url, slug, locale);
      if (page) batch.push({ slug, title: (page.title as Record<string, string>)[locale] || slug });
      else {
        skipped++;
        skipSet.add(slug);
      }
    } catch {
      skipped++;
      skipSet.add(slug);
    }
  }
  if (skipped > 0) {
    try {
      await writeJsonDoc(SKIP_KEY, { origin, slugs: [...skipSet] });
    } catch {
      /* best effort */
    }
  }

  const remaining = Math.max(0, pending.length - batch.length - skipped);
  return {
    total: urls.length,
    imported: batch.length,
    skipped,
    remaining,
    done: remaining === 0,
    batch,
  };
}
