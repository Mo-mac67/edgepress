import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { DEFAULT_SEO, DEFAULT_THEME, type MediaItem, type NavItem, type Page, type Post, type SeoSettings, type SiteSettings, type ThemeSettings } from "./cms-types";
import { seedPages, seedNav, seedSettings } from "@/lib/cms-seed";
import { defaultLocale } from "@/i18n/config";

const PAGES = "cms-pages.json";
const NAV = "cms-nav.json";
const SETTINGS = "cms-settings.json";
const POSTS = "cms-posts.json";
const MEDIA = "cms-media.json";
const THEME = "cms-theme.json";

const uid = () => randomUUID().slice(0, 8);

/**
 * When a KV doc is empty/missing, seed it and *best-effort* persist. A failed
 * persist (KV write not permitted in the current runtime context, rate limit,
 * etc.) must NEVER propagate: we still return the freshly-seeded data so pages
 * always render. This is the guard against the empty-KV → write-fail →
 * permanent-500 failure mode that took the site down on 2026-07-10.
 */
async function seedIfEmpty<T>(key: string, current: T[], seed: () => T[]): Promise<T[]> {
  if (current.length > 0) return current;
  const seeded = seed();
  try {
    await writeJsonDoc(key, seeded);
  } catch {
    /* best effort — return seeded data regardless so the page still renders */
  }
  return seeded;
}

// ─── Pages ──────────────────────────────────────────────
export async function getPages(): Promise<Page[]> {
  return seedIfEmpty(PAGES, await readJsonDoc<Page[]>(PAGES, []), seedPages);
}

export async function getPage(slug: string): Promise<Page | null> {
  return (await getPages()).find((p) => p.slug === slug) ?? null;
}

export async function savePage(page: Page): Promise<void> {
  const pages = await getPages();
  const idx = pages.findIndex((p) => p.id === page.id);
  page.updatedAt = new Date().toISOString();
  if (idx === -1) pages.push(page);
  else pages[idx] = page;
  await writeJsonDoc(PAGES, pages);
}

export async function deletePage(id: string): Promise<boolean> {
  const pages = await getPages();
  const target = pages.find((p) => p.id === id);
  if (!target || target.system) return false;
  await writeJsonDoc(PAGES, pages.filter((p) => p.id !== id));
  return true;
}

// ─── Page revisions (version history) ──────────────────
export interface Revision {
  id: string;
  at: string;
  title: string;
  snapshot: Page;
}
const REV_KEY = (pageId: string) => `cms-rev-${pageId}.json`;
const MAX_REVISIONS = 25;

/** Snapshot the current stored page BEFORE it's overwritten, so the history
 *  always reflects previously-saved states (not the incoming one). */
export async function snapshotRevision(pageId: string): Promise<void> {
  const current = (await getPages()).find((p) => p.id === pageId);
  if (!current) return;
  const revs = await readJsonDoc<Revision[]>(REV_KEY(pageId), []);
  const last = revs[0];
  // Skip if nothing changed since the last snapshot.
  if (last && JSON.stringify(last.snapshot.blocks) === JSON.stringify(current.blocks) && JSON.stringify(last.snapshot.title) === JSON.stringify(current.title)) return;
  const next: Revision[] = [
    { id: uid(), at: new Date().toISOString(), title: current.title.en || current.slug || "home", snapshot: current },
    ...revs,
  ].slice(0, MAX_REVISIONS);
  try {
    await writeJsonDoc(REV_KEY(pageId), next);
  } catch {
    /* best effort */
  }
}

export async function getRevisions(pageId: string): Promise<Omit<Revision, "snapshot">[]> {
  const revs = await readJsonDoc<Revision[]>(REV_KEY(pageId), []);
  return revs.map(({ id, at, title }) => ({ id, at, title }));
}

export async function restoreRevision(pageId: string, revId: string): Promise<Page | null> {
  const revs = await readJsonDoc<Revision[]>(REV_KEY(pageId), []);
  const rev = revs.find((r) => r.id === revId);
  if (!rev) return null;
  await snapshotRevision(pageId); // preserve the current state before restoring
  const restored: Page = { ...rev.snapshot, id: pageId };
  await savePage(restored);
  return restored;
}

export function blankPage(slug: string, title: string, rawHtml?: string): Page {
  return {
    id: uid(),
    slug,
    status: "draft",
    title: { en: title, fr: title },
    description: { en: "", fr: "" },
    blocks: [],
    ...(rawHtml ? { mode: "html" as const, rawHtml, hideChrome: /<html[\s>]/i.test(rawHtml) } : {}),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Theme ──────────────────────────────────────────────
export async function getTheme(): Promise<ThemeSettings> {
  const t = await readJsonDoc<ThemeSettings | null>(THEME, null);
  return t ?? DEFAULT_THEME;
}
export async function saveTheme(t: ThemeSettings): Promise<void> {
  await writeJsonDoc(THEME, t);
}

// ─── SEO ────────────────────────────────────────────────
const SEO = "cms-seo.json";

export async function getSeo(): Promise<SeoSettings> {
  const s = await readJsonDoc<SeoSettings | null>(SEO, null);
  if (!s) {
    // First run: mint an IndexNow key so instant indexing works out of the box.
    const seeded: SeoSettings = { ...DEFAULT_SEO, indexNowKey: randomUUID().replace(/-/g, "") };
    try {
      await writeJsonDoc(SEO, seeded);
    } catch {
      /* best effort */
    }
    return seeded;
  }
  if (!s.indexNowKey) s.indexNowKey = randomUUID().replace(/-/g, "");
  return { ...DEFAULT_SEO, ...s, business: { ...DEFAULT_SEO.business, ...s.business } };
}
export async function saveSeo(s: SeoSettings): Promise<void> {
  await writeJsonDoc(SEO, s);
}

// ─── Nav ────────────────────────────────────────────────
export async function getNav(): Promise<NavItem[]> {
  return seedIfEmpty(NAV, await readJsonDoc<NavItem[]>(NAV, []), seedNav);
}
export async function saveNav(items: NavItem[]): Promise<void> {
  await writeJsonDoc(NAV, items);
}

// ─── Settings ───────────────────────────────────────────
export async function getSettings(): Promise<SiteSettings> {
  const s = await readJsonDoc<SiteSettings | null>(SETTINGS, null);
  if (s) return s;
  const seeded = seedSettings();
  try {
    await writeJsonDoc(SETTINGS, seeded);
  } catch {
    /* best effort — see seedIfEmpty note */
  }
  return seeded;
}
export async function saveSettings(s: SiteSettings): Promise<void> {
  await writeJsonDoc(SETTINGS, s);
}

/** The site's active content locales — always includes the default language.
 *  Defaults to the built-in en/fr when the owner hasn't configured any. */
export async function getActiveLocales(): Promise<string[]> {
  const s = await getSettings();
  const clean = (Array.isArray(s.locales) ? s.locales : [])
    .map((l) => String(l).trim().toLowerCase())
    .filter((l) => /^[a-z]{2}(-[a-z]{2})?$/.test(l));
  const list = clean.length ? Array.from(new Set(clean)) : ["en", "fr"];
  return list.includes(defaultLocale) ? list : [defaultLocale, ...list];
}

// ─── Blog posts ─────────────────────────────────────────
export async function getPosts(): Promise<Post[]> {
  const posts = await readJsonDoc<Post[]>(POSTS, []);
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}
export async function getPost(slug: string): Promise<Post | null> {
  return (await getPosts()).find((p) => p.slug === slug) ?? null;
}
export async function savePost(post: Post): Promise<void> {
  const posts = await readJsonDoc<Post[]>(POSTS, []);
  const idx = posts.findIndex((p) => p.id === post.id);
  if (idx === -1) posts.push(post);
  else posts[idx] = post;
  await writeJsonDoc(POSTS, posts);
}
export async function deletePost(id: string): Promise<boolean> {
  const posts = await readJsonDoc<Post[]>(POSTS, []);
  const next = posts.filter((p) => p.id !== id);
  if (next.length === posts.length) return false;
  await writeJsonDoc(POSTS, next);
  return true;
}
export function blankPost(slug: string, title: string): Post {
  return {
    id: uid(),
    slug,
    status: "draft",
    title: { en: title, fr: title },
    excerpt: { en: "", fr: "" },
    cover: "",
    body: { en: "<p></p>", fr: "<p></p>" },
    date: new Date().toISOString().slice(0, 10),
    author: "Admin",
  };
}

// ─── Media index (files live in R2) ─────────────────────
export async function getMedia(): Promise<MediaItem[]> {
  const m = await readJsonDoc<MediaItem[]>(MEDIA, []);
  return m.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}
export async function addMedia(item: MediaItem): Promise<void> {
  const m = await readJsonDoc<MediaItem[]>(MEDIA, []);
  m.push(item);
  await writeJsonDoc(MEDIA, m);
}
export async function removeMedia(id: string): Promise<MediaItem | null> {
  const m = await readJsonDoc<MediaItem[]>(MEDIA, []);
  const item = m.find((x) => x.id === id);
  if (!item) return null;
  await writeJsonDoc(MEDIA, m.filter((x) => x.id !== id));
  return item;
}
export async function setMediaAlt(id: string, alt: string): Promise<MediaItem | null> {
  const m = await readJsonDoc<MediaItem[]>(MEDIA, []);
  const item = m.find((x) => x.id === id);
  if (!item) return null;
  item.alt = alt;
  await writeJsonDoc(MEDIA, m);
  return item;
}
