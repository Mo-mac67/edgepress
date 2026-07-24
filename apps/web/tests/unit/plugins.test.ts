import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-plugins-"));
});

import { getPluginSkills, getPlugins, installPlugin, uninstallPlugin, validatePluginManifest } from "@/lib/plugins-store";
import { getSnippets } from "@/lib/snippets-store";

describe("validatePluginManifest (pure)", () => {
  it("requires a name/id", () => {
    expect(validatePluginManifest({})).toHaveProperty("error");
    expect(validatePluginManifest("nope")).toHaveProperty("error");
  });
  it("normalizes and namespaces snippet names under the plugin id", () => {
    const m = validatePluginManifest({ name: "Testimonials Pack", version: "1.2.0", snippets: [{ name: "Quote", html: "<q>hi</q>" }] });
    expect("error" in m).toBe(false);
    if ("error" in m) return;
    expect(m.id).toBe("testimonials-pack");
    expect(m.snippets?.[0].name).toBe("testimonials-pack-quote");
    expect(m.version).toBe("1.2.0");
  });
  it("defaults a bad version and drops non-scalar settings", () => {
    const m = validatePluginManifest({ name: "X", version: "abc", settings: { a: "1", bad: { nested: true }, n: 5 } });
    if ("error" in m) throw new Error("should validate");
    expect(m.version).toBe("0.0.0");
    expect(m.settings).toEqual({ a: "1", n: 5 });
  });
});

describe("install / uninstall (fs adapter)", () => {
  it("installs snippets so they render, and skill is exposed", async () => {
    const r = await installPlugin({ name: "Promo Kit", version: "1.0.0", snippets: [{ name: "banner", html: "<b>PROMO</b>" }], skill: "Use [snippet promo-kit-banner]." });
    expect("error" in r).toBe(false);
    expect((await getSnippets()).some((s) => s.name === "promo-kit-banner")).toBe(true);
    expect((await getPluginSkills()).some((s) => s.id === "promo-kit")).toBe(true);
  });

  it("re-installing upgrades in place (no duplicate)", async () => {
    await installPlugin({ name: "Promo Kit", version: "1.1.0", snippets: [{ name: "banner", html: "<b>v2</b>" }] });
    expect((await getPlugins()).filter((p) => p.id === "promo-kit").length).toBe(1);
    expect((await getPlugins()).find((p) => p.id === "promo-kit")?.version).toBe("1.1.0");
  });

  it("uninstall removes the plugin AND exactly its snippets", async () => {
    await installPlugin({ name: "Keep Me", version: "1.0.0", snippets: [{ name: "keep", html: "<i>keep</i>" }] });
    expect(await uninstallPlugin("promo-kit")).toBe(true);
    const snippets = await getSnippets();
    expect(snippets.some((s) => s.name === "promo-kit-banner")).toBe(false);
    expect(snippets.some((s) => s.name === "keep-me-keep")).toBe(true); // other plugin's snippet survives
    expect((await getPlugins()).some((p) => p.id === "promo-kit")).toBe(false);
  });
});
