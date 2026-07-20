import "server-only";
import { getPages, getPosts, getSeo } from "./cms-store";
import { tx, type Block, type Page } from "./cms-types";

const SITE = () => process.env.SITE_URL ?? "http://localhost:3000";

// ─── Content extraction ─────────────────────────────────
function blockText(b: Block, locale: string): string {
  const parts: string[] = [];
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") parts.push(v.replace(/<[^>]+>/g, " "));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("en" in o || "fr" in o) parts.push(String(tx(o, locale)).replace(/<[^>]+>/g, " "));
      else Object.values(o).forEach(walk);
    }
  };
  walk(b.data);
  return parts.join(" ");
}

export function pageText(page: Page, locale: string): string {
  if (page.mode === "html") return (page.rawHtml ?? "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  return page.blocks.map((b) => blockText(b, locale)).join(" ").replace(/\s+/g, " ").trim();
}

// ─── Audit ──────────────────────────────────────────────
export interface SeoCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface PageAudit {
  pageId: string;
  slug: string;
  title: string;
  score: number;
  checks: SeoCheck[];
}

export async function auditPages(locale: string = "en"): Promise<PageAudit[]> {
  const pages = (await getPages()).filter((p) => p.status === "published");
  return pages.map((p) => {
    const title = tx(p.title, locale);
    const desc = tx(p.description, locale);
    const text = pageText(p, locale);
    const words = text.split(/\s+/).filter(Boolean).length;
    const hasHero = p.mode === "html" || p.blocks.some((b) => b.type === "hero" || b.type === "header");
    const hasImages = p.mode === "html" ? /<img/i.test(p.rawHtml ?? "") : p.blocks.some((b) => JSON.stringify(b.data).includes("/images/") || JSON.stringify(b.data).includes("/api/media/"));
    const hasCta = p.mode === "html" || p.blocks.some((b) => b.type === "cta" || b.type === "contactForm" || b.type === "hero");

    const checks: SeoCheck[] = [
      { id: "title", label: "Title length 30–60 chars", pass: title.length >= 30 && title.length <= 60, detail: `${title.length} chars` },
      { id: "desc", label: "Meta description 70–160 chars", pass: desc.length >= 70 && desc.length <= 160, detail: `${desc.length} chars` },
      { id: "h1", label: "Has a main heading (hero/header block)", pass: hasHero, detail: hasHero ? "OK" : "Add a Hero or Section header block" },
      { id: "words", label: "Enough content (150+ words)", pass: words >= 150, detail: `${words} words` },
      { id: "images", label: "Has images", pass: hasImages, detail: hasImages ? "OK" : "Add at least one image" },
      { id: "cta", label: "Has a call to action", pass: hasCta, detail: hasCta ? "OK" : "Add a CTA or contact form block" },
      { id: "slug", label: "Clean URL slug", pass: /^[a-z0-9/-]*$/.test(p.slug), detail: `/${p.slug || "(home)"}` },
      { id: "indexable", label: "Indexable by search engines", pass: !p.seo?.noindex, detail: p.seo?.noindex ? "noindex is ON" : "OK" },
    ];
    const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
    return { pageId: p.id, slug: p.slug, title: title || "(untitled)", score, checks };
  });
}

// ─── IndexNow (instant indexing: Bing, Yandex, Seznam, …) ───
export async function submitIndexNow(urls?: string[]): Promise<{ ok: boolean; submitted: number; status?: number; error?: string }> {
  const seo = await getSeo();
  const host = new URL(SITE()).host;
  let list = urls;
  if (!list) {
    const [pages, posts] = await Promise.all([getPages(), getPosts()]);
    list = [
      ...pages.filter((p) => p.status === "published").flatMap((p) => [`${SITE()}/en/${p.slug}`, `${SITE()}/fr/${p.slug}`]),
      ...posts.filter((p) => p.status === "published").flatMap((p) => [`${SITE()}/en/blog/${p.slug}`, `${SITE()}/fr/blog/${p.slug}`]),
    ].map((u) => u.replace(/\/$/, ""));
  }
  if (list.length === 0) return { ok: true, submitted: 0 };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: seo.indexNowKey,
        keyLocation: `${SITE()}/indexnow-key.txt`,
        urlList: list.slice(0, 500),
      }),
    });
    if (res.ok || res.status === 202) return { ok: true, submitted: list.length, status: res.status };
    if (res.status === 429)
      return { ok: false, submitted: 0, status: 429, error: "Rate-limited by IndexNow — automatic pings on publish keep working; try the bulk submit again in a few hours." };
    return { ok: false, submitted: 0, status: res.status, error: `IndexNow rejected the request (${res.status})` };
  } catch (err) {
    return { ok: false, submitted: 0, error: err instanceof Error ? err.message : "failed" };
  }
}

/** Fire-and-forget publish ping — never blocks or fails a save. */
export async function pingIndexNow(slug: string): Promise<void> {
  try {
    const seo = await getSeo();
    if (!seo.autoIndexNow) return;
    await submitIndexNow([`${SITE()}/en/${slug}`.replace(/\/$/, ""), `${SITE()}/fr/${slug}`.replace(/\/$/, "")]);
  } catch {
    /* never break a save on an indexing ping */
  }
}

// ─── AI meta generation (routed through the provider-agnostic AI engine) ──
export async function generateMeta(page: Page, locale: string): Promise<{ title: string; description: string } | { error: string }> {
  const { aiComplete, extractJson } = await import("./ai/engine");
  const text = pageText(page, locale).slice(0, 4000);
  const lang = locale === "fr" ? "French" : "English";
  try {
    const { text: raw } = await aiComplete("seoMeta", {
      system: `You are an expert SEO copywriter. Based on the web page content, write in ${lang} an SEO title (30-60 chars, include the top keyword) and a meta description (120-160 chars, with a call to action). Match the page's own topic — do not invent an industry. Respond ONLY with JSON: {"title":"...","description":"..."}`,
      prompt: text,
      json: true,
      maxTokens: 300,
    });
    const json = extractJson<{ title: string; description: string }>(raw);
    return { title: String(json.title ?? ""), description: String(json.description ?? "") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI generation failed" };
  }
}
