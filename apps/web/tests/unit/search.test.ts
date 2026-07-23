import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-search-"));
});

import { savePage, savePost } from "@/lib/cms-store";
import { searchContent } from "@/lib/search";
import type { Page, Post } from "@/lib/cms-types";

const L = (en: string) => ({ en, fr: "" });

const page = (over: Partial<Page>): Page =>
  ({
    id: Math.random().toString(36).slice(2),
    slug: "p-" + Math.random().toString(36).slice(2),
    status: "published",
    title: L("Untitled"),
    description: L(""),
    blocks: [],
    updatedAt: new Date().toISOString(),
    ...over,
  }) as Page;

const post = (over: Partial<Post>): Post =>
  ({
    id: Math.random().toString(36).slice(2),
    slug: "b-" + Math.random().toString(36).slice(2),
    status: "published",
    title: L("Untitled"),
    excerpt: L(""),
    cover: "",
    body: L(""),
    date: "2026-07-22",
    author: "Test",
    ...over,
  }) as Post;

describe("searchContent (fs adapter)", () => {
  beforeAll(async () => {
    await savePage(page({ slug: "pricing", title: L("Pricing plans"), description: L("Simple zebra pricing") }));
    await savePage(page({ slug: "hidden-draft", status: "draft", title: L("Zebra secret") }));
    await savePage(page({ slug: "binned", trashed: true, title: L("Zebra trashed") }));
    await savePost(post({ slug: "hello", title: L("Hello world"), body: L("<p>A zebra walked into the savannah.</p>") }));
  });

  it("finds live pages and posts, ranks title hits first", async () => {
    const hits = await searchContent("zebra", "en");
    expect(hits.map((h) => h.path).sort()).toEqual(["blog/hello", "pricing"]);
  });

  it("never surfaces drafts or trashed items", async () => {
    const hits = await searchContent("zebra", "en");
    expect(hits.some((h) => h.path.includes("hidden") || h.path.includes("binned"))).toBe(false);
  });

  it("is case-insensitive and produces a snippet around the match", async () => {
    const hits = await searchContent("ZEBRA", "en");
    const postHit = hits.find((h) => h.type === "post");
    expect(postHit?.snippet).toContain("zebra");
    expect(postHit?.snippet).not.toContain("<p>");
  });

  it("rejects queries shorter than 2 chars", async () => {
    expect(await searchContent("z", "en")).toEqual([]);
    expect(await searchContent("  ", "en")).toEqual([]);
  });
});
