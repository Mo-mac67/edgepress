import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_PRESETS, presetToTheme, themeCss, type ThemeColors, type ThemeSettings } from "@edgepress/core/types";

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

describe("theme gallery", () => {
  it("every theme carries a full design, not just a palette", () => {
    for (const p of THEME_PRESETS) {
      expect(p.fontPair, `${p.id} has no fontPair`).toBeTruthy();
      expect(p.radius, `${p.id} has no radius`).toBeTruthy();
      expect(p.headerStyle, `${p.id} has no headerStyle`).toBeTruthy();
      expect(p.description, `${p.id} has no description`).toBeTruthy();
    }
  });

  it("ids are unique — they key the saved theme and the exported filename", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applying a theme replaces the whole design, keeping unrelated settings", () => {
    const current: ThemeSettings = { ...DEFAULT_THEME, fontPair: "minimal", radius: "sharp", customCss: ".x{}" };
    const terracotta = THEME_PRESETS.find((p) => p.id === "terracotta")!;
    const next = presetToTheme(terracotta, current);
    expect(next.preset).toBe("terracotta");
    expect(next.fontPair).toBe("editorial"); // came from the theme
    expect(next.radius).toBe("round");
    expect(next.colors.accent).toBe(terracotta.colors.accent);
    expect(next.customCss).toBe(".x{}"); // your own CSS is never clobbered
  });

  it("a theme with no typography opinion leaves yours alone", () => {
    const current: ThemeSettings = { ...DEFAULT_THEME, fontPair: "bold", radius: "round", headerStyle: "light" };
    const next = presetToTheme({ id: "x", label: "X", colors: DEFAULT_THEME.colors }, current);
    expect(next.fontPair).toBe("bold");
    expect(next.radius).toBe("round");
    expect(next.headerStyle).toBe("light");
  });

  it("every theme stays readable once rendered", () => {
    // Guards the gallery against shipping a palette whose body text or primary
    // button is unreadable — the failure mode a colour-only preset can hide.
    const lum = (hex: string) => {
      const n = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => {
        const v = parseInt(n.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const p of THEME_PRESETS) {
      const c = {
        ...p.colors,
        bg: p.colors.bg ?? "#ffffff",
        accentInk: p.colors.accentInk ?? "#ffffff",
        heading: p.colors.heading ?? p.colors.brand,
      };
      expect(ratio(c.ink, c.bg), `${p.id}: body text on page`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.heading!, c.bg), `${p.id}: headings on page`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.accentInk!, c.accent), `${p.id}: text on primary button`).toBeGreaterThanOrEqual(4.5);
    }
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
