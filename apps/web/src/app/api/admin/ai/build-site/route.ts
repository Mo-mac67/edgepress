import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { blankPage, getSettings, getPages, saveNav, savePage, saveSettings, saveTheme } from "@/lib/cms-store";
import { generatePageBlocks, generateSitePlan } from "@/lib/ai/features";
import { DEFAULT_THEME, type NavItem, type Page, type ThemeSettings } from "@/lib/cms-types";
import { randomUUID } from "node:crypto";

const uid = () => randomUUID().slice(0, 8);
const clampHex = (h: string, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : fb);
function mixWhite(hex: string, keep: number): string {
  let out = "#";
  for (let i = 1; i < 7; i += 2) {
    const v = parseInt(hex.slice(i, i + 2), 16);
    out += Math.round(255 - (255 - v) * keep).toString(16).padStart(2, "0");
  }
  return out;
}
function darken(hex: string, f: number): string {
  let out = "#";
  for (let i = 1; i < 7; i += 2) out += Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0");
  return out;
}

/**
 * AI Site Builder — a business description becomes a themed, multi-page draft
 * site. Everything lands as drafts / editable settings; nothing is published
 * without the owner reviewing. Replaces theme + nav + brand name; adds pages.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const description = String(body.description ?? "").trim();
  const locale = body.locale === "fr" ? "fr" : "en";
  if (description.length < 10) return NextResponse.json({ error: "Describe your business in a sentence or two." }, { status: 422 });

  try {
    const plan = await generateSitePlan(description, locale);

    // Theme
    const brand = clampHex(plan.theme?.brand ?? "", DEFAULT_THEME.colors.brand);
    const brandDark = clampHex(plan.theme?.brandDark ?? "", darken(brand, 0.7));
    const accent = clampHex(plan.theme?.accent ?? "", DEFAULT_THEME.colors.accent);
    const theme: ThemeSettings = {
      preset: "ai",
      colors: {
        brand,
        brandDark,
        brandSoft: mixWhite(brand, 0.12),
        accent,
        accentDark: darken(accent, 0.75),
        accentSoft: mixWhite(accent, 0.18),
        sand: "#f6f6fb",
        cream: "#fcfcfe",
        ink: "#161821",
        inkSoft: "#5f6577",
        line: "#e7e8f0",
        lineDark: mixWhite(brandDark, 0.85),
      },
      fontPair: (["modern", "elegant", "bold", "minimal", "editorial"].includes(plan.theme?.fontPair) ? plan.theme.fontPair : "modern") as ThemeSettings["fontPair"],
      radius: (["sharp", "soft", "round"].includes(plan.theme?.radius) ? plan.theme.radius : "soft") as ThemeSettings["radius"],
      headerStyle: plan.theme?.headerStyle === "light" ? "light" : "dark",
    };
    await saveTheme(theme);

    // Settings (brand name + tagline)
    const settings = await getSettings();
    await saveSettings({ ...settings, brandName: plan.brandName || settings.brandName, footerTagline: { ...settings.footerTagline, [locale]: plan.tagline || settings.footerTagline[locale] } });

    // Nav
    if (Array.isArray(plan.nav) && plan.nav.length) {
      const nav: NavItem[] = plan.nav.map((n) => ({ id: uid(), label: { en: "", fr: "", [locale]: n.label } as NavItem["label"], href: n.slug.replace(/^\//, "") }));
      await saveNav(nav);
    }

    // Pages (generate blocks per page, all drafts)
    const existing = await getPages();
    const created: string[] = [];
    for (const p of plan.pages) {
      const slug = String(p.slug ?? "").toLowerCase().replace(/[^a-z0-9/-]/g, "-").replace(/^-+|-+$/g, "");
      const blocks = await generatePageBlocks(`${p.title}: ${p.intent}. Brand: ${plan.brandName}. ${plan.tagline}`, locale);
      const idx = existing.findIndex((x) => x.slug === slug);
      const base: Page = idx !== -1 ? existing[idx] : blankPage(slug, p.title);
      const page: Page = { ...base, slug, status: "draft", blocks, title: { en: "", fr: "", [locale]: p.title } as Page["title"] };
      await savePage(page);
      created.push(slug || "(home)");
    }

    await logAudit({ action: "ai_build_site", role: await getRole(), detail: `${plan.brandName}: ${created.length} pages` });
    return NextResponse.json({ ok: true, brandName: plan.brandName, pages: created });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Site build failed" }, { status: 502 });
  }
}
