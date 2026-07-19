"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { BlockEditor } from "./BlockEditor";
import { MediaField } from "./MediaField";
import { BLOCKS, BLOCK_ORDER, newBlock, type Block, type BlockType, type Page } from "@/lib/cms-types";
import type { Locale } from "@/i18n/config";

const uid = () => Math.random().toString(36).slice(2, 10);

export function PageEditor({ initial, uiLocale }: { initial: Page; uiLocale: Locale }) {
  const router = useRouter();
  const [page, setPage] = useState<Page>({ mode: "blocks", ...initial });
  const [locale, setLocale] = useState<Locale>("en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);

  const isHtml = page.mode === "html";
  const setBlocks = (blocks: Block[]) => setPage({ ...page, blocks });
  const patch = (p: Partial<Page>) => setPage({ ...page, ...p });

  function addBlock(type: BlockType) {
    setBlocks([...page.blocks, newBlock(type)]);
    setShowAdd(false);
  }
  function updateBlock(i: number, b: Block) {
    const next = page.blocks.slice();
    next[i] = b;
    setBlocks(next);
  }
  function duplicateBlock(i: number) {
    const next = page.blocks.slice();
    next.splice(i + 1, 0, { ...structuredClone(page.blocks[i]), id: uid() });
    setBlocks(next);
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= page.blocks.length) return;
    const next = page.blocks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/admin/pages/${page.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: page.title,
        description: page.description,
        slug: page.slug,
        status: page.status,
        blocks: page.blocks,
        mode: page.mode ?? "blocks",
        rawHtml: page.rawHtml ?? "",
        hideChrome: !!page.hideChrome,
        seo: page.seo ?? {},
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setPreviewKey((k) => k + 1); // reload the live preview
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const publicPath = `/${locale}/${page.slug}`;

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      <style dangerouslySetInnerHTML={{ __html: "body>header,body>footer{display:none!important}" }} />
      {/* Toolbar */}
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/${uiLocale}/admin`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink-soft hover:text-brand">
              <Icon name="arrow-left" size={16} /> Back
            </Link>
            <span className="hidden truncate font-display font-bold text-brand sm:block">
              {page.title[locale] || page.title.en}
              <span className="ml-2 text-xs font-normal text-ink-soft">/{page.slug || "(home)"}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-line p-0.5 text-sm">
              {(["en", "fr"] as Locale[]).map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={`rounded-full px-3 py-1 ${locale === l ? "bg-accent-soft font-semibold text-accent-dark" : "text-ink-soft"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setPreview((p) => !p)} className={`hidden py-2 text-sm lg:inline-flex ${preview ? "btn-dark" : "btn-secondary"}`}>
              <Icon name="image" size={15} /> Preview
            </button>
            <a href={publicPath} target="_blank" rel="noopener noreferrer" className="btn-secondary py-2 text-sm">
              <Icon name="arrow-up-right" size={15} /> View
            </a>
            <button onClick={save} disabled={saving} className="btn-primary py-2 text-sm">
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      </header>

      <div className={`grid flex-1 gap-0 ${preview ? "lg:grid-cols-2" : ""}`}>
        {/* Editor column */}
        <div className="min-w-0 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Page settings */}
            <details className="card group p-4" open>
              <summary className="flex cursor-pointer items-center justify-between font-display font-bold text-brand">
                Page settings
                <Icon name="chevron-down" size={16} className="transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Title ({locale.toUpperCase()})</span>
                  <input className="field" value={page.title[locale]} onChange={(e) => patch({ title: { ...page.title, [locale]: e.target.value } })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">URL slug</span>
                  <input className="field" value={page.slug} disabled={page.system} onChange={(e) => patch({ slug: e.target.value })} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-ink">SEO description ({locale.toUpperCase()})</span>
                  <textarea className="field min-h-[60px]" value={page.description[locale]} onChange={(e) => patch({ description: { ...page.description, [locale]: e.target.value } })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Status</span>
                  <select className="field" value={page.status} onChange={(e) => patch({ status: e.target.value as Page["status"] })}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Page type</span>
                  <select className="field" value={page.mode ?? "blocks"} onChange={(e) => patch({ mode: e.target.value as Page["mode"] })}>
                    <option value="blocks">Block builder</option>
                    <option value="html">Custom HTML</option>
                  </select>
                </label>
                {isHtml && (
                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input type="checkbox" checked={!!page.hideChrome} onChange={(e) => patch({ hideChrome: e.target.checked })} />
                    <span className="text-sm text-ink">Standalone page (hide the site header &amp; footer)</span>
                  </label>
                )}
              </div>
            </details>

            {/* Per-page SEO */}
            <details className="card group p-4">
              <summary className="flex cursor-pointer items-center justify-between font-display font-bold text-brand">
                SEO
                <Icon name="chevron-down" size={16} className="transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-3">
                <div>
                  <span className="mb-1 block text-sm font-medium text-ink">Social share image (Open Graph)</span>
                  <MediaField value={page.seo?.ogImage ?? ""} onChange={(v) => patch({ seo: { ...page.seo, ogImage: v } })} />
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Keywords (comma-separated)</span>
                  <input
                    className="field"
                    value={page.seo?.keywords ?? ""}
                    placeholder="custom home builder toronto, renovation gta"
                    onChange={(e) => patch({ seo: { ...page.seo, keywords: e.target.value } })}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!page.seo?.noindex} onChange={(e) => patch({ seo: { ...page.seo, noindex: e.target.checked } })} />
                  <span className="text-sm text-ink">Hide from search engines (noindex)</span>
                </label>
                <p className="text-xs text-ink-soft">The SEO title and description are the page Title and SEO description above. Full site audit lives in the SEO tab.</p>
              </div>
            </details>

            {/* Content */}
            {isHtml ? (
              <div className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display font-bold text-brand">HTML source</h3>
                  <label className="btn-secondary cursor-pointer py-1.5 text-xs">
                    <Icon name="download" size={13} /> Replace with file
                    <input
                      type="file"
                      accept=".html,.htm"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) patch({ rawHtml: await f.text() });
                      }}
                    />
                  </label>
                </div>
                <textarea
                  className="field min-h-[480px] font-mono text-xs leading-relaxed"
                  spellCheck={false}
                  value={page.rawHtml ?? ""}
                  onChange={(e) => patch({ rawHtml: e.target.value })}
                  placeholder="<!doctype html>… paste or drop your HTML here"
                />
                <p className="mt-2 text-xs text-ink-soft">
                  Full documents keep their own CSS/JS and render isolated. Fragments are styled by the site theme.
                </p>
              </div>
            ) : (
              <>
                {page.blocks.map((block, i) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    locale={locale}
                    index={i}
                    total={page.blocks.length}
                    onChange={(b) => updateBlock(i, b)}
                    onDelete={() => setBlocks(page.blocks.filter((_, k) => k !== i))}
                    onDuplicate={() => duplicateBlock(i)}
                    onMove={(dir) => moveBlock(i, dir)}
                  />
                ))}
                <div className="relative">
                  <button onClick={() => setShowAdd((s) => !s)} className="btn-dark w-full">
                    <Icon name="check" size={18} /> Add block
                  </button>
                  {showAdd && (
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-3">
                      {BLOCK_ORDER.map((type) => (
                        <button
                          key={type}
                          onClick={() => addBlock(type)}
                          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand hover:bg-sand"
                        >
                          <Icon name={BLOCKS[type].icon as "check"} size={15} className="text-accent-dark" />
                          {BLOCKS[type].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Live preview */}
        {preview && (
          <div className="hidden border-l border-line bg-white lg:block">
            <div className="sticky top-16 h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between border-b border-line px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Live preview — saved version</p>
                <button onClick={() => setPreviewKey((k) => k + 1)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-dark hover:underline">
                  <Icon name="refresh" size={13} /> Refresh
                </button>
              </div>
              <iframe key={previewKey} src={publicPath} title="Preview" className="h-[calc(100%-2.4rem)] w-full border-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
