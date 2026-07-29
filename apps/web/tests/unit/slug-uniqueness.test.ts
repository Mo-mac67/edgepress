import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Two items sharing a slug is silent data loss: getPage/getPost return the first
 * match, so the second is unreachable while the save reported success. These
 * pin the store's guarantee that a slug always belongs to exactly one item.
 */

const page = (id: string, slug: string, extra: Record<string, unknown> = {}) => ({
  id, slug, status: "published",
  title: { en: id, fr: id }, description: { en: "", fr: "" },
  blocks: [], updatedAt: new Date().toISOString(), ...extra,
}) as never;

const post = (id: string, slug: string, extra: Record<string, unknown> = {}) => ({
  id, slug, status: "published",
  title: { en: id, fr: id }, excerpt: { en: "", fr: "" }, cover: "",
  body: { en: "", fr: "" }, date: new Date().toISOString(), author: "", ...extra,
}) as never;

describe("slug uniqueness", () => {
  const dir = `.tmp-slug-${process.pid}`;
  beforeEach(() => {
    process.env.EDGEPRESS_STORAGE = "fs";
    process.env.DATA_DIR = dir;
  });
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(dir, { recursive: true, force: true });
  });

  it("suffixes a second page that wants a taken slug, and says what it used", async () => {
    const { savePage, getPage, getPages } = await import("@/lib/cms-store");

    const first = await savePage(page("a", "pricing"));
    expect(first).toBe("pricing");

    const second = await savePage(page("b", "pricing"));
    expect(second).toBe("pricing-2");

    // Both must be reachable — that's the whole point.
    expect((await getPage("pricing"))?.id).toBe("a");
    expect((await getPage("pricing-2"))?.id).toBe("b");
    expect((await getPages()).filter((p) => p.slug === "pricing")).toHaveLength(1);
  });

  it("keeps counting up rather than colliding again", async () => {
    const { savePage } = await import("@/lib/cms-store");
    await savePage(page("a", "team"));
    await savePage(page("b", "team"));
    expect(await savePage(page("c", "team"))).toBe("team-3");
  });

  it("does not rename a page when it saves itself again", async () => {
    const { savePage, getPages } = await import("@/lib/cms-store");
    await savePage(page("a", "contact-us"));
    // An edit, or an autosave — the slug is its own, so it must stay.
    expect(await savePage(page("a", "contact-us", { status: "draft" }))).toBe("contact-us");
    expect((await getPages()).filter((p) => p.slug === "contact-us")).toHaveLength(1);
  });

  it("lets a new page take the slug of a trashed one", async () => {
    const { savePage, deletePage } = await import("@/lib/cms-store");
    await savePage(page("a", "offer"));
    await deletePage("a"); // soft delete — not served any more
    // Blocking here would punish someone for deleting and recreating a page.
    expect(await savePage(page("b", "offer"))).toBe("offer");
  });

  it("never lets a second page claim the home slug", async () => {
    const { savePage, getPage } = await import("@/lib/cms-store");
    const seededHome = await getPage("");
    const homeId = seededHome?.id ?? "home";
    if (!seededHome) await savePage(page(homeId, ""));

    // An empty slug can't be suffixed to "-2", so it gets a real name instead.
    expect(await savePage(page("intruder", ""))).toBe("home-2");
    expect((await getPage(""))?.id).toBe(homeId);
  });

  it("applies to posts as well", async () => {
    const { savePost, getPost } = await import("@/lib/cms-store");
    expect(await savePost(post("p1", "launch"))).toBe("launch");
    expect(await savePost(post("p2", "launch"))).toBe("launch-2");
    expect((await getPost("launch"))?.id).toBe("p1");
    expect((await getPost("launch-2"))?.id).toBe("p2");
  });

  it("reports whether a slug is taken, so the editor can warn first", async () => {
    const { savePage, pageSlugTaken, savePost, postSlugTaken } = await import("@/lib/cms-store");
    await savePage(page("a", "services"));
    expect(await pageSlugTaken("services")).toBe(true);
    // Not "taken" from the point of view of the page that owns it.
    expect(await pageSlugTaken("services", "a")).toBe(false);
    expect(await pageSlugTaken("nothing-here")).toBe(false);

    await savePost(post("p1", "news"));
    expect(await postSlugTaken("news")).toBe(true);
    expect(await postSlugTaken("news", "p1")).toBe(false);
  });
});
