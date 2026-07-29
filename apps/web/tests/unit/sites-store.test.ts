import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeSiteUrl, summarize } from "@/lib/sites-store";

/**
 * The console holds API keys for other people's sites, so the two things worth
 * pinning down are: a key never reaches the browser, and a client site being
 * down is reported rather than thrown.
 */

describe("normalizeSiteUrl", () => {
  it("accepts a bare hostname and trims to the origin", () => {
    expect(normalizeSiteUrl("client.com")).toBe("https://client.com");
    expect(normalizeSiteUrl("https://client.com/admin/")).toBe("https://client.com");
    expect(normalizeSiteUrl("  https://a.b.co:8443/x?y=1 ")).toBe("https://a.b.co:8443");
  });

  it("refuses plain http, because an API key would travel in the clear", () => {
    expect(normalizeSiteUrl("http://client.com")).toBeNull();
    // localhost is the exception — that's a developer testing their own machine.
    expect(normalizeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("refuses nonsense", () => {
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl("   ")).toBeNull();
    expect(normalizeSiteUrl("not a url at all")).toBeNull();
  });
});

describe("summarize", () => {
  it("counts what needs attention", () => {
    const s = summarize([
      { id: "1", name: "A", url: "https://a.com", addedAt: "", hasKey: true, lastStatus: { updateAvailable: true, counts: { pages: 1, pagesTotal: 1, posts: 0, postsTotal: 0, leads: 3, newLeads: 2 } } },
      { id: "2", name: "B", url: "https://b.com", addedAt: "", hasKey: true, lastError: "Could not reach the site." },
      { id: "3", name: "C", url: "https://c.com", addedAt: "", hasKey: true, lastStatus: { updateAvailable: false, counts: { pages: 4, pagesTotal: 5, posts: 2, postsTotal: 2, leads: 1, newLeads: 1 } } },
    ]);
    expect(s).toEqual({ total: 3, unreachable: 1, needUpdate: 1, newLeads: 3 });
  });

  it("copes with sites that have never reported", () => {
    expect(summarize([{ id: "1", name: "A", url: "https://a.com", addedAt: "", hasKey: true }]))
      .toEqual({ total: 1, unreachable: 0, needUpdate: 0, newLeads: 0 });
  });
});

describe("the registry", () => {
  const dir = `.tmp-sites-${process.pid}`;
  beforeEach(() => {
    process.env.EDGEPRESS_STORAGE = "fs";
    process.env.DATA_DIR = dir;
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    const { rm } = await import("node:fs/promises");
    await rm(dir, { recursive: true, force: true });
  });

  it("never returns the API key to the caller", async () => {
    const { addSite, listSites } = await import("@/lib/sites-store");
    const added = await addSite({ name: "Client", url: "client.com", apiKey: "ep_secret_key" });
    expect("error" in added).toBe(false);

    // The whole listing is what the browser receives, so the key must be absent
    // from every shape the console can see.
    const serialized = JSON.stringify(await listSites()) + JSON.stringify(added);
    expect(serialized).not.toContain("ep_secret_key");
    expect(serialized).toContain("hasKey");
  });

  it("rejects a duplicate site and a missing key", async () => {
    const { addSite } = await import("@/lib/sites-store");
    await addSite({ name: "One", url: "https://dup.com", apiKey: "k" });
    expect(await addSite({ name: "Two", url: "https://dup.com/admin", apiKey: "k" })).toEqual({ error: expect.stringContaining("already") });
    expect(await addSite({ name: "No key", url: "https://x.com", apiKey: "" })).toEqual({ error: expect.stringContaining("API key") });
  });

  it("names the site from its own brand when no label was given", async () => {
    const { addSite, refreshSite } = await import("@/lib/sites-store");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: true, brandName: "Acme Ltd", version: "2.2.0" }), { status: 200 }));
    const added = await addSite({ name: "", url: "https://acme.test", apiKey: "k" });
    const site = await refreshSite((added as { id: string }).id);
    expect(site?.name).toBe("Acme Ltd");
    expect(site?.lastStatus?.version).toBe("2.2.0");
    expect(site?.lastError).toBeUndefined();
  });

  it("records a site being down instead of throwing", async () => {
    const { addSite, refreshSite } = await import("@/lib/sites-store");
    vi.stubGlobal("fetch", async () => { throw new Error("ECONNREFUSED"); });
    const added = await addSite({ name: "Down", url: "https://down.test", apiKey: "k" });
    // A console that crashes when a client site is offline is useless precisely
    // when you need it.
    const site = await refreshSite((added as { id: string }).id);
    expect(site?.lastError).toBe("Could not reach the site.");
    expect(site?.lastCheckedAt).toBeTruthy();
  });

  it("explains a revoked key and an old install differently", async () => {
    const { addSite, refreshSite } = await import("@/lib/sites-store");

    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    const a = await addSite({ name: "Revoked", url: "https://r.test", apiKey: "k" });
    expect((await refreshSite((a as { id: string }).id))?.lastError).toMatch(/revoked/i);

    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    const b = await addSite({ name: "Old", url: "https://o.test", apiKey: "k" });
    expect((await refreshSite((b as { id: string }).id))?.lastError).toMatch(/2\.2\+/);
  });

  it("removes a site", async () => {
    const { addSite, removeSite, listSites } = await import("@/lib/sites-store");
    const added = await addSite({ name: "Bye", url: "https://bye.test", apiKey: "k" });
    expect(await removeSite((added as { id: string }).id)).toBe(true);
    expect(await listSites()).toHaveLength(0);
    expect(await removeSite("nope")).toBe(false);
  });
});
