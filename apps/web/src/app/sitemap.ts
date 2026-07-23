import type { MetadataRoute } from "next";
import { getActiveLocales, getPages, getPosts } from "@/lib/cms-store";
import { isLive } from "@/lib/cms-types";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

// Without this, Next prerenders sitemap.xml ONCE at build time — pages
// published after deploy would never appear. Serve it fresh per request.
export const dynamic = "force-dynamic";

/** Built live from the CMS — new pages and posts appear automatically. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, posts, locales] = await Promise.all([getPages(), getPosts(), getActiveLocales()]);
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const p of pages) {
      if (!isLive(p) || p.seo?.noindex) continue;
      entries.push({
        url: `${SITE}/${locale}${p.slug ? `/${p.slug}` : ""}`,
        lastModified: p.updatedAt,
        changeFrequency: p.slug === "" ? "weekly" : "monthly",
        priority: p.slug === "" ? 1 : 0.7,
      });
    }
    for (const post of posts) {
      if (!isLive(post)) continue;
      entries.push({ url: `${SITE}/${locale}/blog/${post.slug}`, lastModified: post.date, changeFrequency: "monthly", priority: 0.6 });
    }
    // Built-in legal fallbacks — only when the site has no CMS page for them
    // (new installs seed editable privacy/terms pages that appear above).
    for (const p of ["privacy", "terms"]) {
      if (!pages.some((pg) => pg.slug === p && isLive(pg))) {
        entries.push({ url: `${SITE}/${locale}/${p}`, changeFrequency: "yearly", priority: 0.3 });
      }
    }
  }
  return entries;
}
