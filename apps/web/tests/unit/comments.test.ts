import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-comments-"));
});

import { addComment, deleteComment, getAllComments, getApprovedComments, setCommentStatus } from "@/lib/comments-store";

describe("comments store (fs adapter)", () => {
  it("rejects junk input", async () => {
    expect(await addComment({ postSlug: "p", author: "", body: "hi" })).toHaveProperty("error");
    expect(await addComment({ postSlug: "p", author: "Al", body: "" })).toHaveProperty("error");
  });

  it("new comments are pending and never publicly visible", async () => {
    const c = await addComment({ postSlug: "hello", author: "Dana", body: "First!" });
    expect("error" in c).toBe(false);
    expect(await getApprovedComments("hello")).toEqual([]);
    expect((await getAllComments()).find((x) => x.author === "Dana")?.status).toBe("pending");
  });

  it("approval makes a comment public for its post only", async () => {
    const c = await addComment({ postSlug: "hello", author: "Sam", body: "Nice post" });
    if ("error" in c) throw new Error("add failed");
    expect(await setCommentStatus(c.id, "approved")).toBe(true);
    expect((await getApprovedComments("hello")).map((x) => x.author)).toContain("Sam");
    expect(await getApprovedComments("other-post")).toEqual([]);
  });

  it("concurrent submissions never lose a comment (append-log)", async () => {
    await Promise.all([...Array(12)].map((_, i) => addComment({ postSlug: "race", author: `R${i}`, body: `c${i}` })));
    const all = await getAllComments();
    expect(all.filter((c) => c.postSlug === "race").length).toBe(12);
  });

  it("delete removes for good", async () => {
    const c = await addComment({ postSlug: "hello", author: "Gone", body: "bye" });
    if ("error" in c) throw new Error("add failed");
    expect(await deleteComment(c.id)).toBe(true);
    expect((await getAllComments()).some((x) => x.id === c.id)).toBe(false);
  });
});
