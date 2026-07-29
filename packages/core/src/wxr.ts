/**
 * WordPress eXtended RSS (WXR) parser — the file Tools → Export produces.
 *
 * Hand-rolled on purpose: Workers has no DOMParser, and pulling in an XML
 * library for one import path would cost every install bundle size forever.
 * WXR is a narrow, well-known shape, so a targeted scanner is both smaller and
 * easier to reason about than a general parser — but it means being deliberate
 * about the two things that actually bite: CDATA and entity decoding.
 *
 * Pure and dependency-free, so it's unit-testable without a WordPress install.
 */

export interface WxrItem {
  /** WordPress numeric post id, useful for parent/child and idempotency. */
  postId?: string;
  title: string;
  /** Original public URL — the source of truth for redirects. */
  link: string;
  /** post | page | attachment | nav_menu_item | … */
  postType: string;
  /** publish | draft | pending | private | inherit | trash */
  status: string;
  slug: string;
  date?: string;
  author?: string;
  /** Post body HTML. */
  content: string;
  excerpt: string;
  categories: string[];
  tags: string[];
  /** For attachments: the original file URL. */
  attachmentUrl?: string;
  /** Featured-image attachment id, when WordPress recorded one. */
  thumbnailId?: string;
}

export interface WxrParseResult {
  /** Site URL from the channel header — needed to detect internal links. */
  siteUrl?: string;
  items: WxrItem[];
}

/** XML entities that appear in real exports. Numeric refs handled separately. */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

export function decodeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref.startsWith("#")) {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref] ?? whole;
  });
}

/**
 * Read one element's text. CDATA is taken verbatim (post bodies are full of
 * HTML and `<` must NOT be entity-decoded twice); plain text is decoded once.
 */
function tagText(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return undefined;
  const raw = m[1];
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  return cdata ? cdata[1] : decodeXml(raw);
}

/** All `<category domain="…">` values for one domain (category vs post_tag). */
function categoryValues(itemXml: string, domain: string): string[] {
  const out: string[] = [];
  const re = /<category\b([^>]*)>([\s\S]*?)<\/category>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(itemXml))) {
    const attrs = m[1];
    if (!new RegExp(`domain\\s*=\\s*["']${domain}["']`, "i").test(attrs)) continue;
    const raw = m[2];
    const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
    // Prefer the nicename attribute (a slug) when present; fall back to the label.
    const nice = /nicename\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    const value = (nice ?? (cdata ? cdata[1] : decodeXml(raw))).trim();
    if (value) out.push(value);
  }
  return [...new Set(out)];
}

/** A `<wp:postmeta>` value by key — that's where the featured image lives. */
function postMeta(itemXml: string, key: string): string | undefined {
  const re = /<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(itemXml))) {
    if (tagText(m[1], "wp:meta_key") === key) return tagText(m[1], "wp:meta_value");
  }
  return undefined;
}

/** Slug from `<wp:post_name>`, or the last path segment of the link. */
function slugFrom(itemXml: string, link: string): string {
  const name = tagText(itemXml, "wp:post_name");
  if (name?.trim()) return decodeURIComponent(name.trim());
  try {
    const path = new URL(link).pathname.replace(/\/+$/, "");
    return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
  } catch {
    return "";
  }
}

export function parseWxr(xml: string): WxrParseResult {
  // The channel header carries the site URL; take it before scanning items so a
  // malformed item can't hide it.
  const header = xml.slice(0, xml.indexOf("<item>") === -1 ? xml.length : xml.indexOf("<item>"));
  const siteUrl = tagText(header, "wp:base_site_url") ?? tagText(header, "link");

  const items: WxrItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const it = m[1];
    const link = tagText(it, "link") ?? "";
    items.push({
      postId: tagText(it, "wp:post_id"),
      title: (tagText(it, "title") ?? "").trim(),
      link,
      postType: (tagText(it, "wp:post_type") ?? "post").trim(),
      status: (tagText(it, "wp:status") ?? "publish").trim(),
      slug: slugFrom(it, link),
      date: tagText(it, "wp:post_date") ?? tagText(it, "pubDate"),
      author: tagText(it, "dc:creator"),
      content: tagText(it, "content:encoded") ?? "",
      excerpt: tagText(it, "excerpt:encoded") ?? "",
      categories: categoryValues(it, "category"),
      tags: categoryValues(it, "post_tag"),
      attachmentUrl: tagText(it, "wp:attachment_url"),
      thumbnailId: postMeta(it, "_thumbnail_id"),
    });
  }
  return { siteUrl: siteUrl?.trim(), items };
}

// ─── Mapping WordPress → EdgePress ──────────────────────────────────────────

/** WordPress statuses that should land as published; everything else is a draft. */
export function mapStatus(wpStatus: string): "published" | "draft" {
  return wpStatus === "publish" ? "published" : "draft";
}

/** WXR dates are "YYYY-MM-DD HH:MM:SS" in site-local time; ISO-ify safely. */
export function mapDate(wpDate: string | undefined): string {
  if (!wpDate) return new Date().toISOString();
  const iso = wpDate.trim().replace(" ", "T");
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * The path a WordPress URL used to live at, for a redirect. Returns undefined
 * for URLs that aren't on the exported site, or that are already just "/".
 */
export function oldPathOf(link: string): string | undefined {
  try {
    const path = new URL(link).pathname.replace(/\/+$/, "");
    return path && path !== "/" ? decodeURIComponent(path) : undefined;
  } catch {
    return undefined;
  }
}

export interface WxrPlan {
  pages: WxrItem[];
  posts: WxrItem[];
  attachments: WxrItem[];
  /** Old path → new path. Skipped when the path already matches. */
  redirects: { from: string; to: string }[];
  skipped: { reason: string; count: number }[];
}

/**
 * Decide what an import would do, without touching storage — so the admin can
 * show real numbers before anything is written.
 */
export function planImport(parsed: WxrParseResult): WxrPlan {
  const pages: WxrItem[] = [];
  const posts: WxrItem[] = [];
  const attachments: WxrItem[] = [];
  const skips = new Map<string, number>();
  const bump = (reason: string) => skips.set(reason, (skips.get(reason) ?? 0) + 1);

  for (const it of parsed.items) {
    // Menu items, revisions and custom CSS are WordPress plumbing, not content.
    if (it.postType === "nav_menu_item" || it.postType === "revision" || it.postType === "custom_css") {
      bump("WordPress internals (menus, revisions)");
      continue;
    }
    if (it.status === "trash") { bump("in the WordPress trash"); continue; }
    if (it.postType === "attachment") {
      if (it.attachmentUrl) attachments.push(it);
      else bump("attachment with no file URL");
      continue;
    }
    if (!it.slug) { bump("no slug could be derived"); continue; }
    if (it.postType === "page") pages.push(it);
    else if (it.postType === "post") posts.push(it);
    else bump(`unsupported type "${it.postType}"`);
  }

  // WordPress pages live at /about; EdgePress serves /<locale>/about, and posts
  // move under /blog — so almost every URL needs a redirect to keep its ranking.
  const redirects: { from: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const it of pages) {
    const from = oldPathOf(it.link);
    if (!from || seen.has(from)) continue;
    const to = `/${it.slug}`;
    if (from !== to) { redirects.push({ from, to }); seen.add(from); }
  }
  for (const it of posts) {
    const from = oldPathOf(it.link);
    if (!from || seen.has(from)) continue;
    redirects.push({ from, to: `/blog/${it.slug}` });
    seen.add(from);
  }

  return {
    pages, posts, attachments, redirects,
    skipped: [...skips.entries()].map(([reason, count]) => ({ reason, count })),
  };
}

/** Rewrite old media URLs in imported HTML to their new homes. */
export function rewriteMediaUrls(html: string, urlMap: Record<string, string>): string {
  let out = html;
  for (const [from, to] of Object.entries(urlMap)) {
    if (!from) continue;
    out = out.split(from).join(to);
  }
  return out;
}
