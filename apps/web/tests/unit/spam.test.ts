import { describe, expect, it } from "vitest";
import { isSpam, spamScore } from "@edgepress/core/spam";

describe("spam heuristic", () => {
  it("passes normal enquiries", () => {
    expect(isSpam("Hi, I'd like a quote for renovating my kitchen next spring.")).toBe(false);
  });

  it("flags link-stuffed spam-term messages", () => {
    expect(isSpam("CHEAP viagra casino!! http://a.example http://b.example backlink seo service")).toBe(true);
  });

  it("scores empty text as 0", () => {
    expect(spamScore("")).toBe(0);
  });

  it("counts multiple URLs", () => {
    expect(spamScore("http://x.example http://y.example")).toBeGreaterThanOrEqual(4);
  });
});
