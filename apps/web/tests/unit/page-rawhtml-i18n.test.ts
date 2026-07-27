import { describe, expect, it } from "vitest";
import { pickRawHtml } from "@/lib/cms-types";

describe("pickRawHtml — per-locale Custom HTML", () => {
  it("returns the per-locale override when present", () => {
    const page = { rawHtml: "<p>shared</p>", rawHtmlI18n: { en: "<p>EN</p>", fr: "<p>FR</p>" } };
    expect(pickRawHtml(page, "en")).toBe("<p>EN</p>");
    expect(pickRawHtml(page, "fr")).toBe("<p>FR</p>");
  });

  it("falls back to shared rawHtml for a locale with no override", () => {
    const page = { rawHtml: "<p>shared</p>", rawHtmlI18n: { en: "<p>EN</p>" } };
    expect(pickRawHtml(page, "fr")).toBe("<p>shared</p>");
  });

  it("falls back to shared rawHtml when there is no per-locale map", () => {
    expect(pickRawHtml({ rawHtml: "<p>shared</p>" }, "en")).toBe("<p>shared</p>");
  });

  it("treats an empty per-locale entry as unset (uses shared)", () => {
    const page = { rawHtml: "<p>shared</p>", rawHtmlI18n: { en: "" } };
    expect(pickRawHtml(page, "en")).toBe("<p>shared</p>");
  });

  it("returns an empty string when nothing is set", () => {
    expect(pickRawHtml({}, "en")).toBe("");
  });
});
