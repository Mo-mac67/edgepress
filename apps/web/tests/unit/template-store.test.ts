import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-tpl-"));
});

import { exportTemplate, importTemplate } from "@/lib/template-store";
import { getPages, getSettings, savePage, saveSettings } from "@/lib/cms-store";
import type { Page } from "@/lib/cms-types";

const mk = (over: Partial<Page>): Page =>
  ({ id: over.id ?? Math.random().toString(36).slice(2), slug: over.slug ?? "p", status: "published", title: { en: "T", fr: "" }, description: { en: "", fr: "" }, blocks: [], updatedAt: new Date().toISOString(), ...over }) as Page;

describe("site template export/import", () => {
  it("exports design + pages but strips business contact info", async () => {
    const s = await getSettings();
    await saveSettings({ ...s, brandName: "Acme", phone: "416-555-1212", email: "a@b.com", address: "1 King St" });
    await savePage(mk({ id: "home", slug: "" }));
    const tpl = await exportTemplate("Kit");
    expect(tpl.edgepressTemplate).toBe(1);
    expect(tpl.settings.brandName).toBe("Acme"); // brand travels
    expect(tpl.settings.phone).toBeUndefined(); // contact does NOT
    expect(tpl.settings.email).toBeUndefined();
    expect(tpl.settings.address).toBeUndefined();
    expect(tpl.pages.some((p) => p.slug === "")).toBe(true);
  });

  it("rejects a non-template file", async () => {
    await expect(importTemplate({ foo: 1 })).rejects.toThrow();
  });

  it("applies a template's pages", async () => {
    const tpl = await exportTemplate();
    tpl.pages = [mk({ id: "about-x", slug: "about-x" })];
    const { pages } = await importTemplate(tpl);
    expect(pages).toBe(1);
    expect((await getPages()).some((p) => p.slug === "about-x")).toBe(true);
  });

  it("does not overwrite the target site's contact info on import", async () => {
    await saveSettings({ ...(await getSettings()), phone: "999-KEEP" });
    await importTemplate({ edgepressTemplate: 1, createdAt: "", theme: (await exportTemplate()).theme, nav: [], settings: { brandName: "New", phone: "111-BAD" }, pages: [] });
    const s = await getSettings();
    expect(s.brandName).toBe("New"); // brand updated
    expect(s.phone).toBe("999-KEEP"); // contact preserved
  });
});
