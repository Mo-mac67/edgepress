"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import {
  FONT_PAIRS,
  RADII,
  THEME_PRESETS,
  type FontPair,
  type HeaderStyle,
  type ThemeColors,
  type ThemeRadius,
  type ThemeSettings,
} from "@/lib/cms-types";

const COLOR_GROUPS: { title: string; keys: { key: keyof ThemeColors; label: string }[] }[] = [
  {
    title: "Primary (headers, footer, dark sections)",
    keys: [
      { key: "brand", label: "Primary" },
      { key: "brandDark", label: "Primary dark" },
      { key: "brandSoft", label: "Primary tint" },
    ],
  },
  {
    title: "Accent (buttons, highlights)",
    keys: [
      { key: "accent", label: "Accent" },
      { key: "accentDark", label: "Accent dark" },
      { key: "accentSoft", label: "Accent tint" },
    ],
  },
  {
    title: "Backgrounds & text",
    keys: [
      { key: "sand", label: "Background A" },
      { key: "cream", label: "Background B" },
      { key: "ink", label: "Text" },
      { key: "inkSoft", label: "Muted text" },
      { key: "line", label: "Borders" },
      { key: "lineDark", label: "Borders (dark bg)" },
    ],
  },
];

export function ThemePanel() {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/theme").then(async (r) => r.ok && setTheme((await r.json()).theme));
  }, []);

  if (!theme) return <p className="text-sm text-ink-soft">Loading…</p>;

  const setColors = (patch: Partial<ThemeColors>) =>
    setTheme({ ...theme, preset: "custom", colors: { ...theme.colors, ...patch } });

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const c = theme.colors;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Presets */}
        <section className="card p-5">
          <h3 className="font-display font-bold text-brand">Theme presets</h3>
          <p className="mt-1 text-sm text-ink-soft">One-click looks. Pick one, then fine-tune anything below.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTheme({ ...theme, preset: p.id, colors: { ...p.colors } })}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  theme.preset === p.id ? "border-accent" : "border-line hover:border-brand"
                }`}
              >
                <div className="flex h-10 overflow-hidden rounded-lg">
                  <span className="flex-1" style={{ background: p.colors.brand }} />
                  <span className="flex-1" style={{ background: p.colors.brandDark }} />
                  <span className="flex-1" style={{ background: p.colors.accent }} />
                  <span className="flex-1" style={{ background: p.colors.sand }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-ink">{p.label}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Colors */}
        <section className="card p-5">
          <h3 className="font-display font-bold text-brand">Colors</h3>
          {COLOR_GROUPS.map((g) => (
            <div key={g.title} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{g.title}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.keys.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <input
                      type="color"
                      value={c[key]}
                      onChange={(e) => setColors({ [key]: e.target.value } as Partial<ThemeColors>)}
                      className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-ink">{label}</span>
                      <span className="block text-[10px] text-ink-soft">{c[key]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Typography, shape, header */}
        <section className="card grid gap-5 p-5 sm:grid-cols-3">
          <div>
            <h3 className="font-display font-bold text-brand">Fonts</h3>
            <div className="mt-3 space-y-2">
              {(Object.keys(FONT_PAIRS) as FontPair[]).map((fp) => (
                <label key={fp} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${theme.fontPair === fp ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="fontPair" checked={theme.fontPair === fp} onChange={() => setTheme({ ...theme, fontPair: fp })} />
                  {FONT_PAIRS[fp].label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-display font-bold text-brand">Corners</h3>
            <div className="mt-3 space-y-2">
              {(Object.keys(RADII) as ThemeRadius[]).map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${theme.radius === r ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="radius" checked={theme.radius === r} onChange={() => setTheme({ ...theme, radius: r })} />
                  {RADII[r].label}
                  <span className="ml-auto inline-block h-5 w-9 border-2 border-ink-soft" style={{ borderRadius: RADII[r].btn }} />
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-display font-bold text-brand">Header</h3>
            <div className="mt-3 space-y-2">
              {(["light", "dark"] as HeaderStyle[]).map((h) => (
                <label key={h} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm capitalize ${theme.headerStyle === h ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="headerStyle" checked={theme.headerStyle === h} onChange={() => setTheme({ ...theme, headerStyle: h })} />
                  {h}
                  <span className={`ml-auto inline-block h-5 w-9 rounded border ${h === "dark" ? "border-transparent" : "border-line"}`} style={{ background: h === "dark" ? c.brandDark : "#fff" }} />
                </label>
              ))}
            </div>
          </div>
        </section>

        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : saved ? "Saved — site updated ✓" : "Save & apply theme"}
        </button>
      </div>

      {/* Live preview */}
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Preview</p>
        <div className="overflow-hidden rounded-xl border border-line shadow-sm">
          {/* mini header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: theme.headerStyle === "dark" ? c.brandDark : "#fff", borderBottom: `1px solid ${c.line}` }}>
            <span className="text-sm font-extrabold" style={{ color: theme.headerStyle === "dark" ? "#fff" : c.brand }}>EdgePress</span>
            <span className="rounded px-3 py-1 text-xs font-bold" style={{ background: c.accent, color: c.brandDark, borderRadius: RADII[theme.radius].btn }}>Get a Quote</span>
          </div>
          {/* mini hero */}
          <div className="px-5 py-8" style={{ background: c.brandDark }}>
            <p className="text-lg font-extrabold leading-tight text-white">Building homes that last</p>
            <p className="mt-2 text-xs" style={{ color: "#ffffffb0" }}>Licensed, insured and warranty-backed across the GTA.</p>
            <span className="mt-4 inline-block px-4 py-2 text-xs font-bold" style={{ background: c.accent, color: c.brandDark, borderRadius: RADII[theme.radius].btn }}>Start your project</span>
          </div>
          {/* mini cards */}
          <div className="grid grid-cols-2 gap-3 p-4" style={{ background: c.sand }}>
            {[0, 1].map((i) => (
              <div key={i} className="border p-3" style={{ background: "#fff", borderColor: c.line, borderRadius: RADII[theme.radius].card }}>
                <span className="inline-grid h-6 w-6 place-items-center rounded" style={{ background: c.brandSoft, color: c.brand }}>
                  <Icon name={i ? "hammer" : "shield"} size={13} />
                </span>
                <p className="mt-2 text-xs font-bold" style={{ color: c.brand }}>{i ? "Craftsmanship" : "Fixed price"}</p>
                <p className="mt-1 text-[10px]" style={{ color: c.inkSoft }}>No hidden costs, ever.</p>
              </div>
            ))}
          </div>
          {/* mini footer */}
          <div className="px-4 py-3 text-[10px]" style={{ background: c.brandDark, color: "#ffffff99" }}>
            © Your site
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Changes apply to the whole site (all pages, header, footer, buttons) after you save.
        </p>
      </aside>
    </div>
  );
}
