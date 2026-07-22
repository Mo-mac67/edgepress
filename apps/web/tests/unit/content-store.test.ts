import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-test-"));
});

import {
  createEntriesBatch,
  createEntry,
  deleteContentType,
  getContentType,
  getEntries,
  getPublishedEntries,
  saveContentType,
  slugify,
  updateEntry,
} from "@/lib/content-store";

describe("slugify", () => {
  it("normalizes to url-safe slugs", () => {
    expect(slugify("  Hello World! ")).toBe("hello-world");
    expect(slugify("Éxo//tic__name")).toBe("xo-tic-name");
  });
});

describe("content types + entries (fs adapter)", () => {
  it("creates a type and rejects duplicates", async () => {
    const t = await saveContentType({ name: "Products", fields: [{ key: "title", label: "Title", type: "text", required: true }] });
    expect("error" in t).toBe(false);
    const dup = await saveContentType({ name: "Products", fields: [{ key: "title", label: "Title", type: "text" }] });
    expect(dup).toHaveProperty("error");
  });

  it("requires at least one field", async () => {
    const t = await saveContentType({ name: "Empty", fields: [] });
    expect(t).toHaveProperty("error");
  });

  it("creates entries, dedupes slugs, filters published", async () => {
    const a = await createEntry("products", { status: "published", data: { title: "Blue Widget" } });
    const b = await createEntry("products", { slug: "blue-widget", status: "draft", data: { title: "Other" } });
    expect("error" in a).toBe(false);
    expect("error" in b).toBe(false);
    if ("error" in a || "error" in b) return;
    expect(a.slug).toBe("blue-widget");
    expect(b.slug).not.toBe(a.slug); // deduped
    expect((await getPublishedEntries("products")).map((e) => e.id)).toEqual([a.id]);
  });

  it("updates entries in place", async () => {
    const e = await createEntry("products", { status: "draft", data: { title: "Patch me" } });
    if ("error" in e) throw new Error("create failed");
    const up = await updateEntry("products", e.id, { status: "published", data: { title: "Patched" } });
    expect(up?.status).toBe("published");
    expect(up?.data.title).toBe("Patched");
  });

  it("bulk-creates with unique slugs in one write", async () => {
    const n = await createEntriesBatch("products", [
      { slug: "bulk", data: { title: "One" } },
      { slug: "bulk", data: { title: "Two" } },
    ]);
    expect(n).toBe(2);
    const slugs = (await getEntries("products")).map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("deleting a type clears its entries", async () => {
    await deleteContentType("products");
    expect(await getContentType("products")).toBeNull();
    expect(await getEntries("products")).toEqual([]);
  });
});
