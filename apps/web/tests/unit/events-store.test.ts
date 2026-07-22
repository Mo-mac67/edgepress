import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dataDir = "";
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  dataDir = mkdtempSync(join(tmpdir(), "ep-events-"));
  process.env.DATA_DIR = dataDir;
});

import { appendEvent, getEvents, weekKey } from "@/lib/events-store";

describe("weekKey", () => {
  it("maps any day of a week to that week's Monday", () => {
    expect(weekKey(new Date("2026-07-22T10:00:00Z"))).toBe("events-w-2026-07-20.json"); // Wed → Mon
    expect(weekKey(new Date("2026-07-20T00:00:00Z"))).toBe("events-w-2026-07-20.json"); // Mon → Mon
    expect(weekKey(new Date("2026-07-26T23:59:59Z"))).toBe("events-w-2026-07-20.json"); // Sun → Mon
    expect(weekKey(new Date("2026-07-27T00:00:00Z"))).toBe("events-w-2026-07-27.json"); // next Mon
  });
});

describe("sharded events store (fs adapter)", () => {
  it("writes only to the current week's shard — never a global history doc", async () => {
    await appendEvent({ type: "pageview", path: "/en", locale: "en", sessionId: "s1" });
    await appendEvent({ type: "quiz_start", path: "/en", locale: "en", sessionId: "s1" });
    const files = readdirSync(dataDir);
    expect(files).toContain(weekKey(new Date()));
    expect(files).not.toContain("events.json");
  });

  it("getEvents returns newest-first with fields normalized", async () => {
    const events = await getEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].createdAt >= events[1].createdAt).toBe(true);
    expect(events.every((e) => e.sessionId && e.createdAt)).toBe(true);
  });

  it("merges legacy pre-shard events.json into reads", async () => {
    const legacy = [{ id: "old1", type: "pageview", path: "/en", locale: "en", sessionId: "legacy", createdAt: "2020-01-01T00:00:00.000Z" }];
    writeFileSync(join(dataDir, "events.json"), JSON.stringify(legacy));
    const events = await getEvents();
    expect(events.some((e) => e.sessionId === "legacy")).toBe(true);
  });
});
