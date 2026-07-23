import { describe, expect, it } from "vitest";
import { isNewerVersion } from "@/lib/update-check";

describe("isNewerVersion", () => {
  it("detects newer major/minor/patch", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.0.9")).toBe(true);
    expect(isNewerVersion("1.0.1", "1.0.0")).toBe(true);
  });

  it("equal or older is not an update", () => {
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false);
    expect(isNewerVersion("0.9.9", "1.0.0")).toBe(false);
  });

  it("tolerates a leading v (GitHub tag style)", () => {
    expect(isNewerVersion("v1.1.0", "1.0.0")).toBe(true);
    expect(isNewerVersion("v1.0.0", "v1.0.0")).toBe(false);
  });

  it("treats malformed segments as 0 instead of crashing", () => {
    expect(isNewerVersion("garbage", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.2", "1.1.9")).toBe(true);
  });
});
