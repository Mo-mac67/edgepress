import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The parser is covered in wxr.test.ts; this covers what happens when the plan
 * meets storage — the parts that could quietly destroy someone's site during a
 * migration.
 */

const WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <wp:base_site_url>https://oldsite.com</wp:base_site_url>
  <item>
    <title>About us</title>
    <link>https://oldsite.com/about/</link>
    <content:encoded><![CDATA[<h2>Who we are</h2><img src="https://oldsite.com/wp-content/uploads/team.jpg">]]></content:encoded>
    <excerpt:encoded></excerpt:encoded>
    <wp:post_name>about</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>page</wp:post_type>
  </item>
  <item>
    <title>First post</title>
    <link>https://oldsite.com/2023/05/first/</link>
    <content:encoded><![CDATA[<p>Hello</p>]]></content:encoded>
    <excerpt:encoded><![CDATA[teaser]]></excerpt:encoded>
    <wp:post_date>2023-05-15 10:00:00</wp:post_date>
    <wp:post_name>first</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>post</wp:post_type>
    <category domain="category" nicename="news"><![CDATA[News]]></category>
  </item>
  <item>
    <title>Unfinished</title>
    <link>https://oldsite.com/?p=9</link>
    <content:encoded><![CDATA[wip]]></content:encoded>
    <excerpt:encoded></excerpt:encoded>
    <wp:post_name>unfinished</wp:post_name>
    <wp:status>draft</wp:status>
    <wp:post_type>post</wp:post_type>
  </item>
</channel></rss>`;

describe("WordPress import → storage", () => {
  const dir = `.tmp-wp-${process.pid}`;
  beforeEach(() => {
    process.env.EDGEPRESS_STORAGE = "fs";
    process.env.DATA_DIR = dir;
  });
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(dir, { recursive: true, force: true });
  });

  it("creates pages and posts, preserving status, date and taxonomy", async () => {
    const { importWxrContent } = await import("@/lib/wp-import");
    const { getPages, getPosts } = await import("@/lib/cms-store");

    const summary = await importWxrContent(WXR, { replaceExisting: true });
    // A fresh install already seeds an /about page, so this one is replaced.
    expect(summary.pages.created + summary.pages.replaced).toBe(1);
    expect(summary.posts.created).toBe(2);

    const about = (await getPages()).find((p) => p.slug === "about");
    expect(about?.status).toBe("published");
    // The original markup is kept verbatim — a migration that reflows the layout
    // isn't a migration.
    expect(about?.mode).toBe("html");
    expect(about?.rawHtml).toContain("<h2>Who we are</h2>");

    const posts = await getPosts();
    const first = posts.find((p) => p.slug === "first");
    expect(first?.status).toBe("published");
    expect(first?.date).toBe("2023-05-15T10:00:00.000Z");
    expect(first?.categories).toEqual(["news"]);

    // A WordPress draft must not go live just because it moved house.
    expect(posts.find((p) => p.slug === "unfinished")?.status).toBe("draft");
  });

  it("creates 301s for the old URLs", async () => {
    const { importWxrContent } = await import("@/lib/wp-import");
    const { getRedirects } = await import("@/lib/redirects-store");

    await importWxrContent(WXR);
    const redirects = await getRedirects();
    const dated = redirects.find((r) => r.from === "/2023/05/first");
    expect(dated?.to).toBe("/blog/first");
    expect(dated?.code).toBe(301);
  });

  it("never overwrites content that already exists", async () => {
    const { importWxrContent } = await import("@/lib/wp-import");
    const { getPages, savePage } = await import("@/lib/cms-store");

    // The real scenario: the owner has already written their own About page
    // (here, the seeded one) and then runs an import.
    const seeded = (await getPages()).find((p) => p.slug === "about")!;
    await savePage({ ...seeded, title: { ...seeded.title, en: "My own About" } } as never);

    const summary = await importWxrContent(WXR);
    expect(summary.pages.created).toBe(0);
    expect(summary.pages.skipped).toBe(1);
    // The owner has to be told, or they will think their About page arrived.
    expect(summary.collisions.pages).toContain("about");

    const about = (await getPages()).filter((p) => p.slug === "about");
    expect(about).toHaveLength(1);
    expect(about[0].title.en).toBe("My own About"); // their work survived
  });

  it("is safe to run twice", async () => {
    const { importWxrContent } = await import("@/lib/wp-import");
    const { getPages, getPosts } = await import("@/lib/cms-store");

    await importWxrContent(WXR);
    const afterFirst = { pages: (await getPages()).length, posts: (await getPosts()).length };
    const second = await importWxrContent(WXR);

    expect(second.pages.created).toBe(0);
    expect(second.posts.created).toBe(0);
    expect((await getPages()).length).toBe(afterFirst.pages);
    expect((await getPosts()).length).toBe(afterFirst.posts);
  });

  it("reports what it did not import instead of dropping it silently", async () => {
    const { inspectWxr } = await import("@/lib/wp-import");
    const withJunk = WXR.replace("</channel>", `
      <item><title>Menu</title><link>https://oldsite.com/m/</link>
        <wp:post_name>m</wp:post_name><wp:status>publish</wp:status>
        <wp:post_type>nav_menu_item</wp:post_type></item>
      </channel>`);
    const plan = inspectWxr(withJunk);
    expect(plan.skipped.reduce((n, s) => n + s.count, 0)).toBeGreaterThan(0);
  });

  it("rewrites old media URLs once a file has been re-hosted", async () => {
    const { importWxrContent, rewriteImportedMedia } = await import("@/lib/wp-import");
    const { getPages } = await import("@/lib/cms-store");

    await importWxrContent(WXR, { replaceExisting: true });
    const changed = await rewriteImportedMedia({
      "https://oldsite.com/wp-content/uploads/team.jpg": "/api/media/wp-import/team.jpg",
    });
    expect(changed.pages).toBe(1);

    const about = (await getPages()).find((p) => p.slug === "about");
    // Left un-rewritten, the new site would hotlink the old one forever.
    expect(about?.rawHtml).not.toContain("oldsite.com");
    expect(about?.rawHtml).toContain("/api/media/wp-import/team.jpg");
  });

  it("rewriting with an empty map touches nothing", async () => {
    const { importWxrContent, rewriteImportedMedia } = await import("@/lib/wp-import");
    await importWxrContent(WXR);
    expect(await rewriteImportedMedia({})).toEqual({ pages: 0, posts: 0 });
  });
});
