import "server-only";
import { getPages, getPosts } from "./cms-store";
import { isLive, tx } from "./cms-types";
import { pageText } from "./seo";

export interface SearchHit {
  type: "page" | "post";
  title: string;
  /** Path relative to the locale root, e.g. "about" or "blog/hello". */
  path: string;
  snippet: string;
  score: number;
}

const MAX_RESULTS = 20;

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** ±80 chars of context around the first match, ellipsized. */
function makeSnippet(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text.slice(0, 160) + (text.length > 160 ? "…" : "");
  const start = Math.max(0, i - 80);
  const end = Math.min(text.length, i + term.length + 80);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

/**
 * Case-insensitive search across live pages and posts.
 * Title matches weigh 5×, description/excerpt 2×, body 1× per occurrence.
 */
export async function searchContent(query: string, locale: string): Promise<SearchHit[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const [pages, posts] = await Promise.all([getPages(), getPosts()]);
  const hits: SearchHit[] = [];

  for (const p of pages.filter((p) => isLive(p))) {
    const title = tx(p.title, locale);
    const desc = tx(p.description, locale);
    const body = pageText(p, locale);
    const score = countOccurrences(title.toLowerCase(), term) * 5 + countOccurrences(desc.toLowerCase(), term) * 2 + countOccurrences(body.toLowerCase(), term);
    if (score > 0) {
      hits.push({ type: "page", title: title || p.slug, path: p.slug === "home" ? "" : p.slug, snippet: makeSnippet(body || desc, term), score });
    }
  }

  for (const p of posts.filter((p) => isLive(p))) {
    const title = tx(p.title, locale);
    const excerpt = tx(p.excerpt, locale);
    const body = stripHtml(tx(p.body, locale));
    const score = countOccurrences(title.toLowerCase(), term) * 5 + countOccurrences(excerpt.toLowerCase(), term) * 2 + countOccurrences(body.toLowerCase(), term);
    if (score > 0) {
      hits.push({ type: "post", title: title || p.slug, path: `blog/${p.slug}`, snippet: makeSnippet(body || excerpt, term), score });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
