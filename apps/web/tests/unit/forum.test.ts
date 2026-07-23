import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-forum-"));
});

import { addReply, addThread, deleteForumItem, getApprovedThread, getApprovedThreads, moderateForumItem } from "@/lib/forum-store";

describe("forum store (fs adapter)", () => {
  it("rejects junk input", async () => {
    expect(await addThread({ title: "ok", body: "", author: "Al" })).toHaveProperty("error");
    expect(await addThread({ title: "abc", body: "hi", author: "Al" })).toHaveProperty("error"); // title too short
  });

  it("new threads are pending and invisible", async () => {
    const t = await addThread({ title: "How do I deploy?", body: "Workers or Docker?", author: "Dana" });
    expect("error" in t).toBe(false);
    expect(await getApprovedThreads()).toEqual([]);
  });

  it("replies only attach to APPROVED threads", async () => {
    const t = await addThread({ title: "Second topic", body: "text", author: "Sam" });
    if ("error" in t) throw new Error("add failed");
    expect(await addReply({ threadId: t.id, body: "hi", author: "Ann" })).toHaveProperty("error"); // still pending
    await moderateForumItem("thread", t.id, "approved");
    const r = await addReply({ threadId: t.id, body: "Use the wizard", author: "Ann" });
    expect("error" in r).toBe(false);
  });

  it("replies stay hidden until approved; counts follow", async () => {
    const t = (await getApprovedThreads())[0];
    expect(t.replyCount).toBe(0);
    const view = await getApprovedThread(t.id);
    expect(view?.replies).toEqual([]);
    const pendingReply = (await import("@/lib/forum-store")).getAllReplies;
    const r = (await pendingReply()).find((x) => x.threadId === t.id);
    await moderateForumItem("reply", r!.id, "approved");
    expect((await getApprovedThreads())[0].replyCount).toBe(1);
    expect((await getApprovedThread(t.id))?.replies.length).toBe(1);
  });

  it("deleting a thread removes its replies too", async () => {
    const t = (await getApprovedThreads())[0];
    expect(await deleteForumItem("thread", t.id)).toBe(true);
    expect(await getApprovedThread(t.id)).toBeNull();
    const { getAllReplies } = await import("@/lib/forum-store");
    expect((await getAllReplies()).some((r) => r.threadId === t.id)).toBe(false);
  });
});
