import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_PRESETS, themeCss, type ThemeColors, type ThemeSettings } from "@edgepress/core/types";

/** The theme layer's public contract: themeCss() is the ONLY bridge between the
 *  CMS and the presentation layer, so every token it emits is load-bearing. */

const vars = (css: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+):([^;}]+)/gi)) out[m[1]] = m[2].trim();
  return out;
};

const withColors = (patch: Partial<ThemeColors>): ThemeSettings => ({
  ...DEFAULT_THEME,
  colors: { ...DEFAULT_THEME.colors, ...patch },
});

describe("themeCss", () => {
  it("emits every colour token the stylesheet consumes", () => {
    const v = vars(themeCss(DEFAULT_THEME));
    for (const token of [
      "--color-brand", "--color-brand-dark", "--color-brand-soft",
      "--color-accent", "--color-accent-dark", "--color-accent-soft", "--color-accent-ink",
      "--color-heading", "--color-bg", "--color-surface",
      "--color-sand", "--color-cream", "--color-ink", "--color-ink-soft",
      "--color-line", "--color-line-dark",
      "--font-display", "--font-sans", "--ui-radius", "--ui-radius-lg",
    ]) {
      expect(v[token], `missing ${token}`).toBeTruthy();
    }
  });

  it("wins over Tailwind's @theme fallback via :root:root specificity", () => {
    expect(themeCss(DEFAULT_THEME).startsWith(":root:root{")).toBe(true);
  });

  it("a theme saved before surfaces/heading existed keeps its old look", () => {
    // Simulate a pre-1.15 stored theme: the newer keys simply aren't there.
    const legacy = withColors({});
    delete (legacy.colors as Partial<ThemeColors>).bg;
    delete (legacy.colors as Partial<ThemeColors>).surface;
    delete (legacy.colors as Partial<ThemeColors>).heading;
    delete (legacy.colors as Partial<ThemeColors>).accentInk;

    const v = vars(themeCss(legacy));
    expect(v["--color-bg"]).toBe("#ffffff"); // page was hardcoded white
    expect(v["--color-surface"]).toBe("#ffffff"); // cards were hardcoded white
    expect(v["--color-heading"]).toBe(legacy.colors.brand); // headings were text-brand
    expect(v["--color-accent-ink"]).toBe("#ffffff"); // buttons were white-on-accent
  });

  it("lets a dark theme drive surfaces and headings independently of brand", () => {
    const v = vars(themeCss(withColors({
      brand: "#12171f", bg: "#0a0c10", surface: "#12171f", heading: "#f2f5f8", accentInk: "#062b20",
    })));
    expect(v["--color-bg"]).toBe("#0a0c10");
    expect(v["--color-surface"]).toBe("#12171f");
    // The whole point of the split: heading is NOT tied to brand any more.
    expect(v["--color-heading"]).toBe("#f2f5f8");
    expect(v["--color-heading"]).not.toBe(v["--color-brand"]);
    expect(v["--color-accent-ink"]).toBe("#062b20");
  });
});

describe("themeCss sanitising", () => {
  // themeCss output is injected into a <style> inside a Custom-HTML page's
  // iframe, so a hostile value (e.g. from an imported theme file) must never
  // be able to close the tag or add declarations.
  it("rejects a value that tries to break out of the <style> tag", () => {
    const css = themeCss(withColors({ brand: "red;}</style><script>alert(1)</script>" }));
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<script>");
    expect(vars(css)["--color-brand"]).toBe(DEFAULT_THEME.colors.brand); // fell back
  });

  it("rejects extra declarations smuggled in via a semicolon", () => {
    const v = vars(themeCss(withColors({ accent: "#fff;--color-ink:#fff" })));
    expect(v["--color-accent"]).toBe(DEFAULT_THEME.colors.accent);
    expect(v["--color-ink"]).toBe(DEFAULT_THEME.colors.ink);
  });

  it("rejects url()/expression payloads but keeps legitimate colour formats", () => {
    expect(vars(themeCss(withColors({ bg: "url(javascript:alert(1))" })))["--color-bg"]).toBe("#ffffff");
    for (const ok of ["#fff", "#ffffff", "#ffffffcc", "rebeccapurple", "rgb(10, 20, 30)", "hsl(210 40% 8%)", "rgba(0,0,0,.5)"]) {
      expect(vars(themeCss(withColors({ bg: ok })))["--color-bg"], ok).toBe(ok);
    }
  });

  it("falls back when a colour is empty or the wrong type", () => {
    expect(vars(themeCss(withColors({ heading: "" })))["--color-heading"]).toBe(DEFAULT_THEME.colors.brand);
    expect(vars(themeCss(withColors({ ink: 123 as unknown as string })))["--color-ink"]).toBe(DEFAULT_THEME.colors.ink);
  });
});

describe("THEME_PRESETS", () => {
  it("every preset defines the full required palette", () => {
    for (const p of THEME_PRESETS) {
      for (const key of Object.keys(DEFAULT_THEME.colors) as (keyof ThemeColors)[]) {
        // accentInk/heading are optional (they fall back to #ffffff / brand).
        if (key === "accentInk" || key === "heading") continue;
        expect(p.colors[key], `${p.id} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships a dark preset whose headings stay readable on its own background", () => {
    const dark = THEME_PRESETS.find((p) => p.id === "midnight-mint");
    expect(dark).toBeDefined();
    const v = vars(themeCss({ ...DEFAULT_THEME, colors: dark!.colors }));
    // A dark canvas with light headings — impossible before heading was split out.
    expect(v["--color-bg"]).toBe("#0a0c10");
    expect(v["--color-heading"]).toBe("#f2f5f8");
    // The mint accent is light, so its text must be dark, not the white default.
    expect(v["--color-accent-ink"]).toBe("#062b20");
  });
});
