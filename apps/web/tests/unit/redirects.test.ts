import { describe, expect, it } from "vitest";
import { matchRedirect, normalizePath, type Redirect } from "@/lib/redirects-store";

const rule = (from: string, to: string, code: 301 | 302 = 301): Redirect => ({ id: from, from, to, code, createdAt: "" });

describe("normalizePath", () => {
  it("normalizes case, slashes and queries", () => {
    expect(normalizePath("Old-Page.HTML")).toBe("/old-page.html");
    expect(normalizePath("/foo/")).toBe("/foo");
    expect(normalizePath("/foo?a=1#b")).toBe("/foo");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("matchRedirect", () => {
  const rules = [
    rule("/old-page", "/en/new-page"),
    rule("/legacy/*", "/en/blog", 302),
    rule("/docs/*", "/en/help/*"),
    rule("/docs/api/*", "/en/developer/*"),
  ];

  it("exact match wins, case/slash-insensitively", () => {
    expect(matchRedirect(rules, "/Old-Page/")).toEqual({ to: "/en/new-page", code: 301 });
  });

  it("wildcard prefix matches the section root and children", () => {
    expect(matchRedirect(rules, "/legacy")).toEqual({ to: "/en/blog", code: 302 });
    expect(matchRedirect(rules, "/legacy/deep/post")).toEqual({ to: "/en/blog", code: 302 });
  });

  it("splat target carries the remainder over", () => {
    expect(matchRedirect(rules, "/docs/getting-started")).toEqual({ to: "/en/help/getting-started", code: 301 });
    expect(matchRedirect(rules, "/docs")).toEqual({ to: "/en/help", code: 301 });
  });

  it("longest wildcard prefix wins", () => {
    expect(matchRedirect(rules, "/docs/api/tokens")).toEqual({ to: "/en/developer/tokens", code: 301 });
  });

  it("returns null when nothing matches", () => {
    expect(matchRedirect(rules, "/nothing-here")).toBeNull();
    expect(matchRedirect(rules, "/docsx")).toBeNull();
  });
});
