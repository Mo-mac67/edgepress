import "server-only";
import { getNav, getPages, getSettings, getTheme, saveNav, savePage, saveSettings, saveTheme } from "./cms-store";
import type { NavItem, Page, SiteSettings, ThemeSettings } from "./cms-types";

/**
 * Site templates ("starter kits"): export a site's DESIGN + STRUCTURE (theme,
 * nav, pages, brand-level settings) as a portable JSON, then apply it to a fresh
 * site to spin up a new client project fast. Deliberately carries NO
 * business-specific contact info, no leads, no users/secrets — the new site
 * fills those in. Pages keep their ids so re-applying a template is idempotent.
 */
export interface SiteTemplate {
  edgepressTemplate: 1;
  name?: string;
  createdAt: string;
  theme: ThemeSettings;
  nav: NavItem[];
  settings: Partial<SiteSettings>;
  pages: Page[];
}

/** Fields that are business-specific and must NOT travel in a template. */
const CONTACT_FIELDS: (keyof SiteSettings)[] = ["phone", "email", "address", "serviceAreas"];

export async function exportTemplate(name?: string): Promise<SiteTemplate> {
  const [theme, nav, settings, pages] = await Promise.all([getTheme(), getNav(), getSettings(), getPages()]);
  const templateSettings: Partial<SiteSettings> = { ...settings };
  for (const f of CONTACT_FIELDS) delete templateSettings[f];
  return {
    edgepressTemplate: 1,
    name: name?.slice(0, 80),
    createdAt: new Date().toISOString(),
    theme,
    nav,
    settings: templateSettings,
    pages: pages.filter((p) => !p.trashed),
  };
}

export async function importTemplate(input: unknown): Promise<{ pages: number }> {
  const t = input as SiteTemplate | null;
  if (!t || t.edgepressTemplate !== 1) throw new Error("Not an EdgePress template file");
  if (t.theme) await saveTheme(t.theme);
  if (Array.isArray(t.nav)) await saveNav(t.nav);
  if (t.settings && typeof t.settings === "object") {
    const current = await getSettings();
    // Merge design/brand fields over the current site; never touch its contact info.
    const incoming = { ...t.settings };
    for (const f of CONTACT_FIELDS) delete (incoming as Record<string, unknown>)[f];
    await saveSettings({ ...current, ...incoming });
  }
  let n = 0;
  for (const p of Array.isArray(t.pages) ? t.pages : []) {
    if (p && typeof p === "object" && typeof p.slug === "string") { await savePage(p); n++; }
  }
  return { pages: n };
}
