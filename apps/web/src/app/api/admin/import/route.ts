import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getNav, getPages, getSettings, savePage, saveNav, saveSettings, saveTheme } from "@/lib/cms-store";
import { DEFAULT_THEME, type Block, type NavItem, type Page, type ThemeSettings } from "@/lib/cms-types";

/**
 * Imports the output of tools/template-importer (import.json):
 * { theme?, pages?[], nav?, contact? } — theme applies site-wide, pages are
 * created as drafts (unique slugs), nav/contact merge into settings.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const result: { theme: boolean; pages: string[]; nav: boolean; contact: boolean } = {
    theme: false, pages: [], nav: false, contact: false,
  };

  if (body.theme?.colors) {
    const theme: ThemeSettings = {
      ...DEFAULT_THEME,
      ...body.theme,
      colors: { ...DEFAULT_THEME.colors, ...body.theme.colors },
      preset: "imported",
    };
    await saveTheme(theme);
    result.theme = true;
  }

  if (Array.isArray(body.pages)) {
    const existing = new Set((await getPages()).map((p) => p.slug));
    for (const raw of body.pages.slice(0, 20)) {
      if (!raw || !Array.isArray(raw.blocks)) continue;
      let slug = String(raw.slug ?? "").toLowerCase().replace(/[^a-z0-9/-]/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) slug = "imported-home";
      while (existing.has(slug)) slug = `${slug}-2`;
      existing.add(slug);
      const page: Page = {
        id: randomUUID().slice(0, 8),
        slug,
        status: "draft",
        title: raw.title?.en ? raw.title : { en: slug, fr: slug },
        description: raw.description ?? { en: "", fr: "" },
        blocks: (raw.blocks as Block[]).slice(0, 60).map((b) => ({
          id: b.id || randomUUID().slice(0, 8),
          type: b.type,
          data: b.data ?? {},
        })),
        updatedAt: new Date().toISOString(),
      };
      await savePage(page);
      result.pages.push(slug || "(home)");
    }
  }

  if (Array.isArray(body.nav) && body.nav.length > 0 && body.applyNav) {
    const nav: NavItem[] = body.nav
      .filter((n: NavItem) => n?.label?.en)
      .slice(0, 10)
      .map((n: NavItem) => ({ id: n.id || randomUUID().slice(0, 8), label: n.label, href: String(n.href ?? "") }));
    if (nav.length) {
      await saveNav(nav);
      result.nav = true;
    }
  }

  if (body.contact && (body.contact.phone || body.contact.email)) {
    const settings = await getSettings();
    await saveSettings({
      ...settings,
      phone: body.contact.phone || settings.phone,
      email: body.contact.email || settings.email,
    });
    result.contact = true;
  }

  // Nav intentionally requires applyNav:true — replacing the live menu should
  // be an explicit choice, not a side effect of previewing a template.
  await logAudit({ action: "template_import", role: await getRole(), detail: `${result.pages.length} pages${result.theme ? " + theme" : ""}` });
  return NextResponse.json({ ok: true, imported: result });
}
