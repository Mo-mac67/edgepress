import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { slugify } from "./content-store";

/**
 * Extensions v1 — reusable snippets (WordPress "reusable blocks"). Define a
 * named piece of HTML once, drop `[snippet name]` into any Custom HTML or
 * rich-text content, edit centrally, updates everywhere. Deliberately
 * declarative: the Workers runtime can't load third-party JS plugins, so the
 * extension surface is snippets + custom code + Content API + webhooks + MCP.
 */

export interface Snippet {
  id: string;
  /** Token name: `[snippet hours-banner]`. */
  name: string;
  html: string;
  updatedAt: string;
}

const KEY = "snippets.json";
const MAX = 100;
const HTML_MAX = 50_000;

export async function getSnippets(): Promise<Snippet[]> {
  return readJsonDoc<Snippet[]>(KEY, []);
}

export async function saveSnippet(input: { name: string; html: string }): Promise<Snippet | { error: string }> {
  const name = slugify(input.name ?? "");
  if (!name) return { error: "Give the snippet a name" };
  const html = String(input.html ?? "").slice(0, HTML_MAX);
  const list = await getSnippets();
  const existing = list.find((s) => s.name === name);
  if (existing) {
    existing.html = html;
    existing.updatedAt = new Date().toISOString();
    await writeJsonDoc(KEY, list);
    return existing;
  }
  if (list.length >= MAX) return { error: `Limit of ${MAX} snippets reached` };
  const snip: Snippet = { id: randomUUID().slice(0, 8), name, html, updatedAt: new Date().toISOString() };
  list.push(snip);
  await writeJsonDoc(KEY, list);
  return snip;
}

export async function deleteSnippet(id: string): Promise<boolean> {
  const list = await getSnippets();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  await writeJsonDoc(KEY, next);
  return true;
}

const TOKEN_RE = /\[snippet\s+([a-z0-9-]+)\]/g;

/** True when the HTML contains any `[snippet …]` token (cheap pre-check). */
export function hasSnippetTokens(html: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(html);
}

/**
 * Replaces `[snippet name]` tokens with the snippet's HTML. Single pass and
 * non-recursive — a snippet containing its own token can't loop. Unknown
 * names render as an HTML comment so broken references are visible in source
 * but invisible on the page.
 */
export function renderSnippets(html: string, snippets: Pick<Snippet, "name" | "html">[]): string {
  if (!html || snippets.length === 0) return html;
  const byName = new Map(snippets.map((s) => [s.name, s.html]));
  return html.replace(TOKEN_RE, (_m, name: string) => byName.get(name) ?? `<!-- snippet "${name}" not found -->`);
}
