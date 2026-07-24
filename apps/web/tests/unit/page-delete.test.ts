import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-pagedel-"));
});

import { deletePage, getPages, savePage } from "@/lib/cms-store";
import type { Page } from "@/lib/cms-types";

const mk = (over: Partial<Page>): Page =>
  ({ id: over.id ?? Math.random().toString(36).slice(2), slug: over.slug ?? "p", status: "published", title: { en: "T", fr: "" }, description: { en: "", fr: "" }, blocks: [], updatedAt: new Date().toISOString(), ...over }) as Page;

describe("deletePage — system pages are deletable too (owner's site)", () => {
  it("soft-trashes a system page (was previously blocked)", async () => {
    await savePage(mk({ id: "sys1", slug: "contact", system: true }));
    expect(await deletePage("sys1")).toBe(true);
    expect((await getPages()).find((p) => p.id === "sys1")?.trashed).toBe(true);
  });

  it("force-deletes a system page for good", async () => {
    await savePage(mk({ id: "sys2", slug: "home2", system: true }));
    expect(await deletePage("sys2", true)).toBe(true);
    expect((await getPages()).some((p) => p.id === "sys2")).toBe(false);
  });

  it("returns false for an unknown id", async () => {
    expect(await deletePage("nope")).toBe(false);
  });
});
