import { describe, expect, it } from "vitest";
import { decodeXml, mapDate, mapStatus, oldPathOf, parseWxr, planImport, rewriteMediaUrls } from "@edgepress/core/wxr";

/**
 * Fixture modelled on a real WordPress export: CDATA bodies containing HTML,
 * entity-encoded titles, a draft, an attachment, trash, a menu item, and a page
 * whose slug only exists in the URL. These are the shapes that actually break
 * naive parsers.
 */
const WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Old Site</title>
  <link>https://oldsite.com</link>
  <wp:base_site_url>https://oldsite.com</wp:base_site_url>

  <item>
    <title>Hello &amp; welcome</title>
    <link>https://oldsite.com/2023/05/hello-world/</link>
    <pubDate>Mon, 15 May 2023 10:00:00 +0000</pubDate>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <content:encoded><![CDATA[<p>Body with <a href="https://oldsite.com/about">a link</a> &amp; an <img src="https://oldsite.com/wp-content/uploads/2023/05/pic.jpg" /></p>]]></content:encoded>
    <excerpt:encoded><![CDATA[Short teaser]]></excerpt:encoded>
    <wp:post_id>11</wp:post_id>
    <wp:post_date>2023-05-15 10:00:00</wp:post_date>
    <wp:post_name>hello-world</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>post</wp:post_type>
    <category domain="category" nicename="news"><![CDATA[Company News]]></category>
    <category domain="post_tag" nicename="launch"><![CDATA[Launch]]></category>
    <wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[42]]></wp:meta_value></wp:postmeta>
  </item>

  <item>
    <title>About us</title>
    <link>https://oldsite.com/about/</link>
    <content:encoded><![CDATA[<h2>Who we are</h2>]]></content:encoded>
    <excerpt:encoded></excerpt:encoded>
    <wp:post_id>2</wp:post_id>
    <wp:post_date>2022-01-02 09:30:00</wp:post_date>
    <wp:post_name>about</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>page</wp:post_type>
  </item>

  <item>
    <title>Half-written</title>
    <link>https://oldsite.com/?p=99</link>
    <content:encoded><![CDATA[draft body]]></content:encoded>
    <excerpt:encoded></excerpt:encoded>
    <wp:post_id>99</wp:post_id>
    <wp:post_name>half-written</wp:post_name>
    <wp:status>draft</wp:status>
    <wp:post_type>post</wp:post_type>
  </item>

  <item>
    <title>pic.jpg</title>
    <link>https://oldsite.com/hello-world/pic/</link>
    <wp:post_id>42</wp:post_id>
    <wp:post_name>pic-jpg</wp:post_name>
    <wp:status>inherit</wp:status>
    <wp:post_type>attachment</wp:post_type>
    <wp:attachment_url>https://oldsite.com/wp-content/uploads/2023/05/pic.jpg</wp:attachment_url>
  </item>

  <item>
    <title>Deleted thing</title>
    <link>https://oldsite.com/gone/</link>
    <wp:post_name>gone</wp:post_name>
    <wp:status>trash</wp:status>
    <wp:post_type>post</wp:post_type>
  </item>

  <item>
    <title>Menu</title>
    <link>https://oldsite.com/menu/</link>
    <wp:post_name>menu-item</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>nav_menu_item</wp:post_type>
  </item>
</channel></rss>`;

describe("decodeXml", () => {
  it("decodes named and numeric entities, leaving unknown ones alone", () => {
    expect(decodeXml("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x2014; &bogus;"))
      .toBe(`a & b <c> "d" 'e' — &bogus;`);
  });
});

describe("parseWxr", () => {
  const parsed = parseWxr(WXR);

  it("reads the source site URL", () => {
    expect(parsed.siteUrl).toBe("https://oldsite.com");
  });

  it("finds every item, including the ones we'll later skip", () => {
    expect(parsed.items).toHaveLength(6);
  });

  it("decodes an entity-encoded title but keeps CDATA HTML verbatim", () => {
    const post = parsed.items[0];
    expect(post.title).toBe("Hello & welcome");
    // The body must survive untouched — double-decoding would turn &amp; into &
    // and corrupt the markup.
    expect(post.content).toContain('<a href="https://oldsite.com/about">a link</a>');
    expect(post.content).toContain("&amp; an");
  });

  it("separates categories from tags and prefers the slug attribute", () => {
    expect(parsed.items[0].categories).toEqual(["news"]);
    expect(parsed.items[0].tags).toEqual(["launch"]);
  });

  it("picks up the featured image id from postmeta", () => {
    expect(parsed.items[0].thumbnailId).toBe("42");
  });

  it("reads the attachment's file URL", () => {
    const att = parsed.items.find((i) => i.postType === "attachment");
    expect(att?.attachmentUrl).toBe("https://oldsite.com/wp-content/uploads/2023/05/pic.jpg");
  });

  it("keeps post_name as the slug even when the link is a ?p= permalink", () => {
    expect(parsed.items[2].slug).toBe("half-written");
  });
});

describe("mapStatus / mapDate", () => {
  it("only publish is published", () => {
    expect(mapStatus("publish")).toBe("published");
    for (const s of ["draft", "pending", "private", "future", "inherit"]) {
      expect(mapStatus(s), s).toBe("draft");
    }
  });

  it("turns a WordPress date into ISO and never returns Invalid Date", () => {
    expect(mapDate("2023-05-15 10:00:00")).toBe("2023-05-15T10:00:00.000Z");
    expect(new Date(mapDate("nonsense")).toString()).not.toBe("Invalid Date");
    expect(new Date(mapDate(undefined)).toString()).not.toBe("Invalid Date");
  });
});

describe("oldPathOf", () => {
  it("extracts the path for a redirect, ignoring the domain and trailing slash", () => {
    expect(oldPathOf("https://oldsite.com/2023/05/hello-world/")).toBe("/2023/05/hello-world");
  });
  it("returns nothing for a bare domain or a broken URL", () => {
    expect(oldPathOf("https://oldsite.com/")).toBeUndefined();
    expect(oldPathOf("not a url")).toBeUndefined();
  });
});

describe("planImport", () => {
  const plan = planImport(parseWxr(WXR));

  it("sorts content into pages, posts and attachments", () => {
    expect(plan.pages.map((p) => p.slug)).toEqual(["about"]);
    expect(plan.posts.map((p) => p.slug)).toEqual(["hello-world", "half-written"]);
    expect(plan.attachments).toHaveLength(1);
  });

  it("drops WordPress plumbing and trash, and says why", () => {
    const reasons = plan.skipped.map((s) => s.reason).join(" | ");
    expect(reasons).toMatch(/internals/i);
    expect(reasons).toMatch(/trash/i);
    // Nothing silently vanishes: every input is either placed or explained.
    const placed = plan.pages.length + plan.posts.length + plan.attachments.length;
    const explained = plan.skipped.reduce((n, s) => n + s.count, 0);
    expect(placed + explained).toBe(6);
  });

  it("builds redirects that preserve the old URLs", () => {
    // A WordPress dated permalink and an EdgePress blog path never match, so
    // the redirect is what keeps the ranking.
    expect(plan.redirects).toContainEqual({ from: "/2023/05/hello-world", to: "/blog/hello-world" });
  });

  it("does not redirect a path to itself", () => {
    // /about already lands on /about — a self-redirect would be a loop.
    expect(plan.redirects.some((r) => r.from === r.to)).toBe(false);
    expect(plan.redirects.some((r) => r.from === "/about")).toBe(false);
  });
});

describe("rewriteMediaUrls", () => {
  it("swaps every occurrence of an old media URL", () => {
    const html = '<img src="https://oldsite.com/wp-content/uploads/pic.jpg"> and again https://oldsite.com/wp-content/uploads/pic.jpg';
    const out = rewriteMediaUrls(html, { "https://oldsite.com/wp-content/uploads/pic.jpg": "/api/media/wp/pic.jpg" });
    expect(out).not.toContain("oldsite.com");
    expect((out.match(/\/api\/media\/wp\/pic\.jpg/g) ?? [])).toHaveLength(2);
  });

  it("leaves html alone when there's nothing to map", () => {
    expect(rewriteMediaUrls("<p>hi</p>", {})).toBe("<p>hi</p>");
  });
});
