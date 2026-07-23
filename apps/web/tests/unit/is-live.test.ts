import { describe, expect, it } from "vitest";
import { isLive } from "@/lib/cms-types";

const NOW = new Date("2026-07-22T12:00:00.000Z");

describe("isLive", () => {
  it("published items are live", () => {
    expect(isLive({ status: "published" }, NOW)).toBe(true);
  });

  it("plain drafts are not live", () => {
    expect(isLive({ status: "draft" }, NOW)).toBe(false);
  });

  it("scheduled draft goes live once publishAt passes", () => {
    expect(isLive({ status: "draft", publishAt: "2026-07-22T11:59:00.000Z" }, NOW)).toBe(true);
    expect(isLive({ status: "draft", publishAt: NOW.toISOString() }, NOW)).toBe(true);
  });

  it("scheduled draft stays hidden before publishAt", () => {
    expect(isLive({ status: "draft", publishAt: "2026-07-22T12:01:00.000Z" }, NOW)).toBe(false);
  });

  it("trashed items are never live, even published or past-scheduled", () => {
    expect(isLive({ status: "published", trashed: true }, NOW)).toBe(false);
    expect(isLive({ status: "draft", publishAt: "2020-01-01T00:00:00.000Z", trashed: true }, NOW)).toBe(false);
  });
});
