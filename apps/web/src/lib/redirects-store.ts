import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Redirect manager — essential when migrating an existing site so old URLs
 * keep working. Rules are checked only on the 404 path (zero cost for pages
 * that exist). Exact match first, then longest matching `/*` prefix rule.
 */

export interface Redirect {
  id: string;
  /** Path to match, e.g. "/old-page" or "/blog-old/*" (prefix wildcard). */
  from: string;
  /** Internal path ("/en/new-page") or full https URL. A trailing "*" appends
   *  the wildcard remainder (e.g. "/blog-old/*" → "/en/blog/*"). */
  to: string;
  /** 301 permanent (default) or 302 temporary. */
  code: 301 | 302;
  createdAt: string;
}

const KEY = "redirects.json";
const MAX_RULES = 500;

/** Lowercased, leading slash, no trailing slash (except root), no query. */
export function normalizePath(p: string): string {
  let out = String(p ?? "").trim().split(/[?#]/)[0].toLowerCase();
  if (!out.startsWith("/")) out = `/${out}`;
  if (out.length > 1) out = out.replace(/\/+$/, "");
  return out;
}

export async function getRedirects(): Promise<Redirect[]> {
  return readJsonDoc<Redirect[]>(KEY, []);
}

export async function saveRedirect(input: { from: string; to: string; code?: number }): Promise<Redirect | { error: string }> {
  const from = input.from?.endsWith("/*") ? `${normalizePath(input.from.slice(0, -2))}/*` : normalizePath(input.from ?? "");
  const to = String(input.to ?? "").trim();
  if (from === "/" || from === "") return { error: "Enter the old path to redirect from" };
  if (!to.startsWith("/") && !/^https?:\/\//.test(to)) return { error: "Target must be a path (/…) or a full URL" };
  if (normalizePath(to) === from) return { error: "A redirect can't point to itself" };
  const list = await getRedirects();
  if (list.length >= MAX_RULES) return { error: `Limit of ${MAX_RULES} redirects reached` };
  const existing = list.find((r) => r.from === from);
  if (existing) return { error: "A rule for that path already exists — delete it first" };
  const rule: Redirect = { id: randomUUID().slice(0, 8), from, to: to.slice(0, 500), code: input.code === 302 ? 302 : 301, createdAt: new Date().toISOString() };
  list.push(rule);
  await writeJsonDoc(KEY, list);
  return rule;
}

export async function deleteRedirect(id: string): Promise<boolean> {
  const list = await getRedirects();
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  await writeJsonDoc(KEY, next);
  return true;
}

/** Pure matcher (unit-tested): exact rule wins, else longest `/*` prefix. */
export function matchRedirect(rules: Redirect[], path: string): { to: string; code: 301 | 302 } | null {
  const p = normalizePath(path);
  const exact = rules.find((r) => r.from === p);
  if (exact) return { to: exact.to, code: exact.code };
  let best: Redirect | null = null;
  for (const r of rules) {
    if (!r.from.endsWith("/*")) continue;
    const prefix = r.from.slice(0, -1); // keep the trailing slash
    if ((p + "/").startsWith(prefix) && (!best || r.from.length > best.from.length)) best = r;
  }
  if (!best) return null;
  const rest = p.slice(best.from.length - 2).replace(/^\//, "");
  const to = best.to.endsWith("*") ? best.to.slice(0, -1).replace(/\/$/, "") + (rest ? `/${rest}` : "") : best.to;
  return { to, code: best.code };
}

/** Match `path` against the stored rules — tries the path as-is, then with the
 *  locale prefix stripped (owners usually enter old URLs without a locale). */
export async function findRedirect(path: string): Promise<{ to: string; code: 301 | 302 } | null> {
  const rules = await getRedirects();
  if (rules.length === 0) return null;
  const direct = matchRedirect(rules, path);
  if (direct) return direct;
  const stripped = normalizePath(path).replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/|$)/, "");
  if (stripped && stripped !== normalizePath(path)) return matchRedirect(rules, stripped);
  return null;
}
