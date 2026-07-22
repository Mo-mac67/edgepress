import { describe, expect, it } from "vitest";
import { blocksToHtml } from "@/lib/blocks-html";
import type { Block, Localized } from "@/lib/cms-types";

const L = (en: string, fr = ""): Localized => ({ en, fr });

const sample: Block[] = [
  {
    id: "1",
    type: "hero",
    data: {
      eyebrow: L("Welcome"),
      title: L("Build faster"),
      subtitle: L("The AI-native CMS."),
      primaryLabel: L("Get started"),
      primaryHref: "/contact",
      image: "/img/hero.jpg",
    },
  },
  {
    id: "2",
    type: "cards",
    data: { title: L("Why us"), items: [{ icon: "check", title: L("Fast"), text: L("Really fast.") }] },
  },
  { id: "3", type: "richtext", data: { html: L("<p>Raw <em>rich</em> text.</p>") } },
];

describe("blocksToHtml", () => {
  const html = blocksToHtml(sample, "en");

  it("uses h1 for the first block's title, h2 after", () => {
    expect(html).toContain("<h1>Build faster</h1>");
    expect(html).toContain("<h2>Why us</h2>");
  });

  it("pairs xxxLabel with xxxHref into links", () => {
    expect(html).toContain('<a href="/contact">Get started</a>');
  });

  it("renders images and list items", () => {
    expect(html).toContain('<img src="/img/hero.jpg"');
    expect(html).toContain("<li>");
    expect(html).toContain("Really fast.");
  });

  it("passes richtext HTML through unescaped", () => {
    expect(html).toContain("<em>rich</em>");
  });

  it("tags sections with their block type", () => {
    expect(html).toContain('data-block="hero"');
    expect(html).toContain('data-block="richtext"');
  });

  it("escapes user text so markup can't be injected via plain fields", () => {
    const out = blocksToHtml([{ id: "x", type: "header", data: { title: L('<script>alert(1)</script>') } }], "en");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders the other locale", () => {
    const out = blocksToHtml([{ id: "x", type: "header", data: { title: { en: "Hello", fr: "Bonjour" } } }], "fr");
    expect(out).toContain("Bonjour");
  });
});
