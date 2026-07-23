import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-rel-"));
});

import { createEntry, expandRelations, getContentType, getEntries, saveContentType } from "@/lib/content-store";

describe("collection relations + expand (fs adapter)", () => {
  beforeAll(async () => {
    await saveContentType({ name: "Authors", fields: [{ key: "name", label: "Name", type: "text", required: true }] });
    await saveContentType({
      name: "Books",
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "author", label: "Author", type: "relation", relatesTo: "authors" },
      ],
    });
    await createEntry("authors", { slug: "tolkien", status: "published", data: { name: "J.R.R. Tolkien" } });
    await createEntry("authors", { slug: "ghost", status: "draft", data: { name: "Unpublished Ghost" } });
    await createEntry("books", { slug: "lotr", status: "published", data: { title: "The Lord of the Rings", author: "tolkien" } });
    await createEntry("books", { slug: "haunted", status: "published", data: { title: "Haunted", author: "ghost" } });
    await createEntry("books", { slug: "orphan", status: "published", data: { title: "Orphan", author: "no-such-author" } });
  });

  it("keeps the relation field's target through schema normalization", async () => {
    const books = await getContentType("books");
    expect(books?.fields.find((f) => f.key === "author")?.relatesTo).toBe("authors");
  });

  it("drops relation fields defined without a target", async () => {
    const t = await saveContentType({ name: "Broken", fields: [{ key: "rel", label: "Rel", type: "relation" }] });
    expect(t).toHaveProperty("error"); // its only field is dropped → no fields left
  });

  it("expands a published target entry in place", async () => {
    const books = (await getContentType("books"))!;
    const expanded = await expandRelations(books, await getEntries("books"));
    const lotr = expanded.find((e) => e.slug === "lotr")!;
    expect(lotr.data.author).toMatchObject({ slug: "tolkien", name: "J.R.R. Tolkien", type: "authors" });
  });

  it("never embeds draft targets — the raw slug stays", async () => {
    const books = (await getContentType("books"))!;
    const expanded = await expandRelations(books, await getEntries("books"));
    expect(expanded.find((e) => e.slug === "haunted")!.data.author).toBe("ghost");
  });

  it("leaves unresolvable references untouched", async () => {
    const books = (await getContentType("books"))!;
    const expanded = await expandRelations(books, await getEntries("books"));
    expect(expanded.find((e) => e.slug === "orphan")!.data.author).toBe("no-such-author");
  });

  it("does not mutate the source entries", async () => {
    const books = (await getContentType("books"))!;
    const source = await getEntries("books");
    await expandRelations(books, source);
    expect(source.find((e) => e.slug === "lotr")!.data.author).toBe("tolkien");
  });
});
