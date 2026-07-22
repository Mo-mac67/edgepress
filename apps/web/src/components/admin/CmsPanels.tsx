"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MediaLibrary } from "./MediaLibrary";
import { useAdminUI } from "./ui";
import type { Locale } from "@/i18n/config";
import type { NavItem, Page, Post, SiteSettings } from "@/lib/cms-types";

const uid = () => Math.random().toString(36).slice(2, 10);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ─── Pages ──────────────────────────────────────────────
export function PagesPanel({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ui = useAdminUI();
  const [pages, setPages] = useState<Page[]>([]);
  const [err, setErr] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/pages");
    if (res.ok) setPages((await res.json()).pages);
  }
  useEffect(() => {
    load();
  }, []);

  async function createPage(payload: { title: string; slug: string; rawHtml?: string }) {
    const res = await fetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) router.push(`/${locale}/admin/pages/${data.page.id}`);
    else setErr(data.error || "Failed");
  }

  async function create() {
    const title = await ui.prompt({
      title: "New page",
      label: "Page title",
      placeholder: "e.g. Pricing",
      confirmLabel: "Create",
      validate: (v) => (v.trim() ? null : "Enter a title"),
    });
    if (!title) return;
    await createPage({ title, slug: slugify(title) });
  }

  async function importFromUrl() {
    const url = await ui.prompt({ title: "Import from a URL", message: "EdgePress will read the page and rebuild it as an editable draft.", label: "Page URL", placeholder: "https://example.com/about", confirmLabel: "Import", validate: (v) => (/^https?:\/\//.test(v) ? null : "Enter a full URL") });
    if (!url) return;
    setImporting(true);
    ui.toast("Reading and rebuilding the page…");
    try {
      const res = await fetch("/api/admin/ai/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, locale }) });
      const d = await res.json();
      if (res.ok) {
        ui.toast("Imported as a draft", "success");
        router.push(`/${locale}/admin/pages/${d.page.id}`);
      } else setErr(d.error || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function importWholeSite() {
    const url = await ui.prompt({
      title: "Import a whole site",
      message: "EdgePress reads the site's sitemap.xml and rebuilds every page as an editable draft. Runs in batches — leave this tab open.",
      label: "Site URL",
      placeholder: "https://your-old-site.com",
      confirmLabel: "Import site",
      validate: (v) => (/^https?:\/\//.test(v) ? null : "Enter a full URL"),
    });
    if (!url) return;
    setImporting(true);
    try {
      let done = false;
      let importedTotal = 0;
      for (let round = 0; round < 30 && !done; round++) {
        const res = await fetch("/api/admin/ai/import-site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, locale }) });
        const d = await res.json();
        if (!res.ok) { setErr(d.error || "Site import failed"); ui.toast(d.error || "Site import failed", "error"); return; }
        importedTotal += d.imported;
        done = d.done;
        if (!done) ui.toast(`Imported ${importedTotal} page(s)… ${d.remaining} to go`);
      }
      ui.toast(`Site imported — ${importedTotal} draft page(s) ready for review`, "success");
      load();
    } finally {
      setImporting(false);
    }
  }

  async function importScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    ui.toast("Reading the screenshot and rebuilding it…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("locale", locale);
      const res = await fetch("/api/admin/ai/import-screenshot", { method: "POST", body: fd });
      const d = await res.json();
      if (res.ok) {
        ui.toast("Imported as a draft — review and edit", "success");
        router.push(`/${locale}/admin/pages/${d.page.id}`);
      } else setErr(d.error || "Screenshot import failed");
    } finally {
      setImporting(false);
    }
  }

  async function generateWithAI() {
    const prompt = await ui.prompt({
      title: "Generate a page with AI",
      message: "Describe the page you want. EdgePress will build a full draft you can refine.",
      label: "Describe the page",
      placeholder: "e.g. A landing page for a boutique coffee roaster with our story, products and a contact form",
      confirmLabel: "Generate",
      validate: (v) => (v.trim().length > 8 ? null : "Add a bit more detail"),
    });
    if (!prompt) return;
    setImporting(true);
    ui.toast("Generating your page…");
    try {
      const res = await fetch("/api/admin/ai/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, locale }),
      });
      const d = await res.json();
      if (res.ok) {
        ui.toast("Draft page created", "success");
        router.push(`/${locale}/admin/pages/${d.page.id}`);
      } else setErr(d.error || "Generation failed");
    } finally {
      setImporting(false);
    }
  }

  async function importHtml(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setErr("Drop a .html file");
      return;
    }
    setImporting(true);
    setErr("");
    try {
      const rawHtml = await file.text();
      const guess = file.name.replace(/\.html?$/i, "");
      const title = await ui.prompt({ title: "Import HTML page", label: "Page title", defaultValue: guess.replace(/[-_]+/g, " "), confirmLabel: "Import" });
      if (!title) return;
      await createPage({ title, slug: slugify(title || guess), rawHtml });
    } finally {
      setImporting(false);
      setDragging(false);
    }
  }

  /** Imports tools/template-importer output: theme + block pages + contact. */
  async function importJson(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setImporting(true);
    setErr("");
    try {
      const data = JSON.parse(await file.text());
      const applyNav =
        Array.isArray(data.nav) && data.nav.length > 0
          ? await ui.confirm({ title: "Replace the menu too?", message: "The imported template includes a navigation menu. Replace your current site menu with it?", confirmLabel: "Replace menu", cancelLabel: "Keep mine" })
          : false;
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, applyNav }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      ui.toast(
        `Imported ${d.imported.pages.length} page(s) as drafts${d.imported.theme ? " + theme" : ""}${d.imported.nav ? " + menu" : ""}.`,
        "success",
      );
      await load();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
      ui.toast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!(await ui.confirm({ title: "Delete page?", message: `“${title}” will be permanently removed.`, confirmLabel: "Delete", danger: true }))) return;
    setPages((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
    ui.toast("Page deleted", "success");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Build pages with blocks, or drop an HTML file to import a ready-made design.</p>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer py-2 text-sm" title="Output of the template-importer tool (theme + block pages)">
            <Icon name="download" size={16} /> Import JSON
            <input type="file" accept=".json" hidden onChange={(e) => importJson(e.target.files)} />
          </label>
          <label className="btn-secondary cursor-pointer py-2 text-sm">
            <Icon name="download" size={16} /> {importing ? "Importing…" : "Import HTML"}
            <input type="file" accept=".html,.htm" hidden onChange={(e) => importHtml(e.target.files)} />
          </label>
          <button onClick={importFromUrl} className="btn-secondary py-2 text-sm" title="Import a page from a URL with AI">
            <Icon name="download" size={16} /> Import URL
          </button>
          <button onClick={importWholeSite} disabled={importing} className="btn-secondary py-2 text-sm" title="Import every page of a site from its sitemap.xml">
            <Icon name="refresh" size={16} /> {importing ? "Importing…" : "Import whole site"}
          </button>
          <label className="btn-secondary cursor-pointer py-2 text-sm" title="Rebuild a page from a screenshot with AI (approximate)">
            <Icon name="image" size={16} /> Import screenshot
            <input type="file" accept="image/*" hidden onChange={importScreenshot} />
          </label>
          <button onClick={generateWithAI} className="btn-secondary py-2 text-sm" title="Generate a page with AI">
            <Icon name="star" size={16} /> Generate with AI
          </button>
          <button onClick={create} className="btn-primary py-2 text-sm">
            <Icon name="check" size={16} /> New page
          </button>
        </div>
      </div>
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      {/* Drop zone + list */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          importHtml(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 transition ${dragging ? "border-dashed border-accent bg-accent-soft/40" : "border-transparent"}`}
      >
        <div className="card divide-y divide-line">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${p.mode === "html" ? "bg-accent-soft text-accent-dark" : "bg-brand-soft text-brand"}`}>
                <Icon name={p.mode === "html" ? "edit" : "list"} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand">
                  {p.title[locale] || p.title.en}
                  {p.system && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">SYSTEM</span>}
                  {p.mode === "html" && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-dark">HTML</span>}
                  {p.status === "draft" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">DRAFT</span>}
                </p>
                <p className="text-xs text-ink-soft">/{p.slug || "(home)"} · {p.mode === "html" ? "imported HTML" : `${p.blocks.length} blocks`} · updated {new Date(p.updatedAt).toLocaleDateString()}</p>
              </div>
              <a href={`/${locale}/${p.slug}`} target="_blank" rel="noopener noreferrer" className="hidden rounded p-2 text-ink-soft hover:text-brand sm:block" title="View">
                <Icon name="arrow-up-right" size={16} />
              </a>
              <Link href={`/${locale}/admin/pages/${p.id}`} className="btn-secondary py-1.5 text-sm">
                <Icon name="edit" size={15} /> Edit
              </Link>
              {!p.system && (
                <button onClick={() => remove(p.id, p.title[locale] || p.title.en)} className="rounded p-2 text-ink-soft hover:text-red-600" title="Delete">
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>
          ))}
          {pages.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">Loading…</p>}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-soft">Tip: drag &amp; drop a <code>.html</code> file anywhere on this list to import it as a page — its own styles and scripts are kept.</p>
    </div>
  );
}

// ─── Menu ───────────────────────────────────────────────
export function MenuPanel({ locale }: { locale: Locale }) {
  const [nav, setNav] = useState<NavItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/nav").then(async (r) => r.ok && setNav((await r.json()).nav));
  }, []);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= nav.length) return;
    const next = nav.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setNav(next);
  };
  const set = (i: number, patch: Partial<NavItem>) => setNav(nav.map((n, k) => (k === i ? { ...n, ...patch } : n)));

  async function save() {
    await fetch("/api/admin/nav", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nav }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Manage the top navigation. Link to a page slug (e.g. <code>services</code>) or a full URL.</p>
        <button onClick={save} className="btn-primary py-2 text-sm">{saved ? "Saved ✓" : "Save menu"}</button>
      </div>
      <div className="space-y-3">
        {nav.map((item, i) => (
          <div key={item.id} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="block"><span className="mb-1 block text-xs text-ink-soft">Label (EN)</span><input className="field" value={item.label.en} onChange={(e) => set(i, { label: { ...item.label, en: e.target.value } })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-ink-soft">Label (FR)</span><input className="field" value={item.label.fr} onChange={(e) => set(i, { label: { ...item.label, fr: e.target.value } })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-ink-soft">Link (slug or URL)</span><input className="field" value={item.href} onChange={(e) => set(i, { href: e.target.value })} /></label>
            <div className="flex items-end gap-1">
              <button onClick={() => move(i, -1)} className="rounded p-2 hover:bg-sand"><Icon name="arrow-left" size={15} className="rotate-90" /></button>
              <button onClick={() => move(i, 1)} className="rounded p-2 hover:bg-sand"><Icon name="arrow-right" size={15} className="rotate-90" /></button>
              <button onClick={() => setNav(nav.filter((_, k) => k !== i))} className="rounded p-2 text-red-600 hover:bg-sand"><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
        <button onClick={() => setNav([...nav, { id: uid(), label: { en: "New link", fr: "Nouveau lien" }, href: "" }])} className="btn-secondary py-2 text-sm">
          <Icon name="check" size={15} /> Add menu item
        </button>
      </div>
    </div>
  );
}

// ─── Media ──────────────────────────────────────────────
export function MediaPanel() {
  return <MediaLibrary />;
}

// ─── Blog ───────────────────────────────────────────────
export function BlogPanel({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ui = useAdminUI();
  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/posts").then(async (r) => r.ok && setPosts((await r.json()).posts));
  }, []);

  async function create() {
    const title = await ui.prompt({ title: "New post", label: "Post title", placeholder: "e.g. How we ship faster", confirmLabel: "Create", validate: (v) => (v.trim() ? null : "Enter a title") });
    if (!title) return;
    const res = await fetch("/api/admin/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, slug: slugify(title) }) });
    const data = await res.json();
    if (res.ok) router.push(`/${locale}/admin/posts/${data.post.id}`);
    else {
      setErr(data.error || "Failed");
      ui.toast(data.error || "Failed to create post", "error");
    }
  }

  async function writeWithAI() {
    const topic = await ui.prompt({ title: "Write an article with AI", message: "Give a topic — AI drafts a full article (title, summary, body, keywords) as a draft post.", label: "Topic", placeholder: "e.g. 5 ways to cut your energy bill this winter", confirmLabel: "Write" });
    if (!topic) return;
    ui.toast("Writing your article…");
    const res = await fetch("/api/admin/ai/article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, locale }) });
    const data = await res.json();
    if (res.ok) { ui.toast("Draft article created", "success"); router.push(`/${locale}/admin/posts/${data.post.id}`); }
    else ui.toast(data.error || "Couldn't write the article", "error");
  }

  async function bulkFromCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const csv = await file.text();
    ui.toast("Writing articles… (up to 3 per run)");
    const res = await fetch("/api/admin/ai/bulk-articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, locale }) });
    const data = await res.json();
    if (res.ok) {
      setPosts((await (await fetch("/api/admin/posts")).json()).posts);
      ui.toast(`Created ${data.created} draft(s)${data.capped ? " — run again for more" : ""}`, "success");
    } else ui.toast(data.error || "Bulk generation failed", "error");
  }

  async function remove(id: string, title: string) {
    if (!(await ui.confirm({ title: "Delete post?", message: `“${title}” will be permanently removed.`, confirmLabel: "Delete", danger: true }))) return;
    setPosts((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
    ui.toast("Post deleted", "success");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">Publish news and articles at <code>/blog</code>.</p>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer py-2 text-sm" title="Bulk-generate drafts from a CSV/list of topics (one per line)">
            <Icon name="download" size={16} /> Bulk from CSV
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={bulkFromCsv} />
          </label>
          <button onClick={writeWithAI} className="btn-secondary py-2 text-sm"><Icon name="star" size={16} /> Write with AI</button>
          <button onClick={create} className="btn-primary py-2 text-sm"><Icon name="check" size={16} /> New post</button>
        </div>
      </div>
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      <div className="card divide-y divide-line">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <div className="flex-1">
              <p className="font-semibold text-brand">{p.title[locale] || p.title.en}{p.status === "draft" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">DRAFT</span>}</p>
              <p className="text-xs text-ink-soft">/blog/{p.slug} · {p.date}</p>
            </div>
            <Link href={`/${locale}/admin/posts/${p.id}`} className="btn-secondary py-1.5 text-sm"><Icon name="edit" size={15} /> Edit</Link>
            <button onClick={() => remove(p.id, p.title[locale] || p.title.en)} className="rounded p-2 text-ink-soft hover:text-red-600"><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {posts.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">No posts yet.</p>}
      </div>
    </div>
  );
}

// ─── Site settings ──────────────────────────────────────
export function SitePanel() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings").then(async (r) => r.ok && setS((await r.json()).settings));
  }, []);

  if (!s) return <p className="text-sm text-ink-soft">Loading…</p>;
  const set = (patch: Partial<SiteSettings>) => setS({ ...s, ...patch });

  async function save() {
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: s }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Text = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <label className="block"><span className="mb-1 block text-sm font-medium text-ink">{label}</span><input className="field" value={value} onChange={(e) => onChange(e.target.value)} /></label>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card space-y-3 p-5">
        <h3 className="font-display font-bold text-brand">Business details</h3>
        <Text label="Brand name" value={s.brandName} onChange={(v) => set({ brandName: v })} />
        <Text label="Phone" value={s.phone} onChange={(v) => set({ phone: v })} />
        <Text label="Email" value={s.email} onChange={(v) => set({ email: v })} />
        <Text label="Address" value={s.address} onChange={(v) => set({ address: v })} />
        <Text label="Hours" value={s.hours} onChange={(v) => set({ hours: v })} />
      </div>
      <div className="card space-y-3 p-5">
        <h3 className="font-display font-bold text-brand">Languages</h3>
        <p className="text-xs text-ink-soft">
          Content locale codes, comma-separated (e.g. <code className="rounded bg-surface-soft px-1">en, fr, es</code>). English (en) is always kept as the fallback. Add a code, then translate pages into it (per-page Translate, or AI → Whole-site translation). Visitors get a language switcher.
        </p>
        <Text
          label="Active languages"
          value={(s.locales?.length ? s.locales : ["en", "fr"]).join(", ")}
          onChange={(v) => set({ locales: v.split(",").map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z]{2}(-[a-z]{2})?$/.test(x)) })}
        />
      </div>
      <div className="card space-y-3 p-5">
        <h3 className="font-display font-bold text-brand">Header</h3>
        <p className="text-xs text-ink-soft">A short kicker shown next to the logo on wide screens.</p>
        <Text label="Tagline (EN)" value={s.headerTagline.en} onChange={(v) => set({ headerTagline: { ...s.headerTagline, en: v } })} />
        <Text label="Tagline (FR)" value={s.headerTagline.fr} onChange={(v) => set({ headerTagline: { ...s.headerTagline, fr: v } })} />
      </div>
      <div className="card space-y-3 p-5">
        <h3 className="font-display font-bold text-brand">Footer</h3>
        <Text label="Tagline (EN)" value={s.footerTagline.en} onChange={(v) => set({ footerTagline: { ...s.footerTagline, en: v } })} />
        <Text label="Tagline (FR)" value={s.footerTagline.fr} onChange={(v) => set({ footerTagline: { ...s.footerTagline, fr: v } })} />
        <Text label="License note (EN)" value={s.licenseNote.en} onChange={(v) => set({ licenseNote: { ...s.licenseNote, en: v } })} />
        <Text label="License note (FR)" value={s.licenseNote.fr} onChange={(v) => set({ licenseNote: { ...s.licenseNote, fr: v } })} />
      </div>
      <div className="card space-y-3 p-5">
        <h3 className="font-display font-bold text-brand">Social links</h3>
        <Text label="Facebook" value={s.social.facebook} onChange={(v) => set({ social: { ...s.social, facebook: v } })} />
        <Text label="Instagram" value={s.social.instagram} onChange={(v) => set({ social: { ...s.social, instagram: v } })} />
        <Text label="LinkedIn" value={s.social.linkedin} onChange={(v) => set({ social: { ...s.social, linkedin: v } })} />
        <Text label="YouTube" value={s.social.youtube} onChange={(v) => set({ social: { ...s.social, youtube: v } })} />
      </div>
      <button onClick={save} className="btn-primary">{saved ? "Saved ✓" : "Save settings"}</button>
    </div>
  );
}
