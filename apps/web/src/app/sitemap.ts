import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { getPages, getPosts } from "@/lib/cms-store";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

/** Built live from the CMS — new pages and posts appear automatically. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, posts] = await Promise.all([getPages(), getPosts()]);
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const p of pages) {
      if (p.status !== "published" || p.seo?.noindex) continue;
      entries.push({
        url: `${SITE}/${locale}${p.slug ? `/${p.slug}` : ""}`,
        lastModified: p.updatedAt,
        changeFrequency: p.slug === "" ? "weekly" : "monthly",
        priority: p.slug === "" ? 1 : 0.7,
      });
    }
    for (const post of posts) {
      if (post.status !== "published") continue;
      entries.push({ url: `${SITE}/${locale}/blog/${post.slug}`, lastModified: post.date, changeFrequency: "monthly", priority: 0.6 });
    }
    for (const p of ["/privacy", "/terms"]) {
      entries.push({ url: `${SITE}/${locale}${p}`, changeFrequency: "yearly", priority: 0.3 });
    }
  }
  return entries;
}
