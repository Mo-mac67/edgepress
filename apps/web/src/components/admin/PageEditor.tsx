"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/Icon";
import { BlockEditor } from "./BlockEditor";
import { CodeEditor } from "./CodeEditor";
import { blocksToHtml } from "@/lib/blocks-html";
import { MediaField } from "./MediaField";
import { Modal, useAdminUI } from "./ui";
import { BLOCKS, BLOCK_ORDER, newBlock, type Block, type BlockType, type Page } from "@/lib/cms-types";
import type { Locale } from "@/i18n/config";

const uid = () => Math.random().toString(36).slice(2, 10);

/** ISO → the local-time string a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const serialize = (p: Page) => JSON.stringify({ t: p.title, d: p.description, s: p.slug, st: p.status, b: p.blocks, m: p.mode, r: p.rawHtml, ri: p.rawHtmlI18n, h: p.hideChrome, seo: p.seo, ab: p.ab, pa: p.publishAt });

/**
 * Build the srcDoc for editing a Custom-HTML page in place. It injects an edit
 * script that makes the text elements contentEditable and, on each change,
 * posts the FULL document back (design untouched — only text nodes differ). The
 * injected style/script + edit attributes are stripped before serializing, so
 * what's saved is clean HTML. For bilingual embeds it targets [data-l] spans
 * and shows the right locale; otherwise it targets block-level text elements.
 */
function buildHtmlEditDoc(html: string, locale: string): string {
  const script = `
<style id="ep-edit-style">[data-ep-ce]{outline:1px dashed rgba(79,240,181,.6);outline-offset:2px;border-radius:2px}[data-ep-ce]:hover{outline-color:#4ff0b5;cursor:text}[data-ep-ce]:focus{outline:2px solid #4ff0b5;background:rgba(79,240,181,.10)}#ep-edit-linkbar *{box-sizing:border-box}</style>
<script id="ep-edit-script">(function(){
var loc=${JSON.stringify(locale)};
if(loc==="fr")document.documentElement.classList.add("fr");
var hasL=document.querySelector("[data-l]");
// Text: bilingual sites edit the [data-l] spans; plain sites edit block text
// plus link/button labels. Link/button DESTINATIONS are edited via the bar below.
var sel=hasL?"[data-l]":"h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,a,button";
[].slice.call(document.querySelectorAll(sel)).forEach(function(el){el.setAttribute("contenteditable","true");el.setAttribute("data-ep-ce","1");el.spellcheck=false;});
var timer;function push(){clearTimeout(timer);timer=setTimeout(function(){
var c=document.documentElement.cloneNode(true);
[].slice.call(c.querySelectorAll("[data-ep-ce]")).forEach(function(n){n.removeAttribute("contenteditable");n.removeAttribute("data-ep-ce");n.removeAttribute("spellcheck");});
var s=c.querySelector("#ep-edit-style");if(s)s.remove();var sc=c.querySelector("#ep-edit-script");if(sc)sc.remove();var lb=c.querySelector("#ep-edit-linkbar");if(lb)lb.remove();c.classList.remove("fr");
parent.postMessage({source:"edgepress",type:"ep-html",locale:loc,value:"<!doctype html>\\n"+c.outerHTML},"*");
},400);}
document.addEventListener("input",function(e){var t=e.target;if(t&&t.getAttribute&&t.getAttribute("data-ep-ce"))push();},true);
// ---- link / button destination editor (floating bar) ----
var bar=document.createElement("div");bar.id="ep-edit-linkbar";bar.setAttribute("contenteditable","false");
bar.style.cssText="position:fixed;left:12px;bottom:12px;z-index:2147483647;display:none;align-items:center;gap:8px;background:#12171f;color:#eef2f6;border:1px solid #2a333f;border-radius:10px;padding:9px 11px;font:13px system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.55)";
bar.innerHTML='<span style="color:#7ff5c8">&#128279; link</span><input id="ep-href" style="width:320px;background:#0a0c10;color:#eef2f6;border:1px solid #2a333f;border-radius:7px;padding:7px 9px;font:13px system-ui,sans-serif;outline:none" placeholder="https://…  /path  mailto:…  tel:…"><button id="ep-href-x" style="background:none;border:0;color:#9fb4ab;cursor:pointer;font-size:15px">&#10005;</button>';
document.body.appendChild(bar);
var curLink=null,hrefInput=bar.querySelector("#ep-href");
function showBar(a){curLink=a;hrefInput.value=a.getAttribute("href")||"";bar.style.display="flex";}
function hideBar(){bar.style.display="none";curLink=null;}
hrefInput.addEventListener("input",function(){if(curLink){curLink.setAttribute("href",hrefInput.value);push();}});
bar.querySelector("#ep-href-x").addEventListener("mousedown",function(e){e.preventDefault();hideBar();});
document.addEventListener("click",function(e){if(bar.contains(e.target))return;var a=e.target&&e.target.closest?e.target.closest("a[href],button"):null;if(a){showBar(a);}else{hideBar();}},true);
})();<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", script + "</body>") : html + script;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function PageEditor({ initial, uiLocale, contentLocales = ["en", "fr"], staleLocales = [] }: { initial: Page; uiLocale: Locale; contentLocales?: string[]; staleLocales?: string[] }) {
  const router = useRouter();
  const ui = useAdminUI();
  const [page, setPage] = useState<Page>({ mode: "blocks", ...initial });
  const [locale, setLocale] = useState<Locale>("en");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [inlineEdit, setInlineEdit] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [autosave, setAutosave] = useState(true);
  const [history, setHistory] = useState<{ id: string; at: string; title: string }[] | null>(null);

  const savedRef = useRef(serialize(page));
  const dirty = serialize(page) !== savedRef.current;

  const isHtml = page.mode === "html";
  // Per-locale Custom HTML: when the map exists, each language has its own HTML;
  // otherwise a single rawHtml is shared across every language.
  const perLocale = isHtml && !!page.rawHtmlI18n;
  const htmlFor = (loc: string) => (perLocale ? page.rawHtmlI18n?.[loc] ?? "" : page.rawHtml ?? "");
  const setHtmlFor = (loc: string, v: string) =>
    perLocale ? patch({ rawHtmlI18n: { ...page.rawHtmlI18n, [loc]: v } }) : patch({ rawHtml: v });
  const setBlocks = (blocks: Block[]) => setPage((p) => ({ ...p, blocks }));
  const patch = (p: Partial<Page>) => setPage((prev) => ({ ...prev, ...p }));

  // Inline visual editing: the preview iframe (loaded with ?epedit=1) posts
  // {blockId, field, locale, value} whenever a tagged element is edited on the
  // page. Patch the matching block's localized field; autosave persists it.
  useEffect(() => {
    if (!inlineEdit) return;
    function onMsg(e: MessageEvent) {
      // Accept only messages from OUR preview iframe. A srcDoc iframe (used for
      // Custom-HTML editing) has a null origin, so match the source window
      // rather than the origin.
      if (e.source !== previewRef.current?.contentWindow) return;
      const m = e.data as { source?: string; type?: string; blockId?: string; field?: string; locale?: string; value?: string };
      if (m?.source !== "edgepress") return;
      // Custom-HTML inline edit: the whole design-preserving document comes back
      // (only text nodes changed). Store it as the raw HTML for this locale.
      if (m.type === "ep-html" && typeof m.value === "string") {
        const loc = m.locale || "en";
        const html = m.value;
        setPage((prev) => (prev.rawHtmlI18n ? { ...prev, rawHtmlI18n: { ...prev.rawHtmlI18n, [loc]: html } } : { ...prev, rawHtml: html }));
        return;
      }
      if (m.type !== "ep-edit" || !m.blockId || !m.field) return;
      const loc = m.locale || "en";
      const value = String(m.value ?? "");
      const setLoc = (target: Record<string, unknown>, key: string) => {
        const cur = target[key];
        target[key] = cur && typeof cur === "object" && !Array.isArray(cur) ? { ...(cur as Record<string, string>), [loc]: value } : { en: "", fr: "", [loc]: value };
      };
      setPage((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== m.blockId) return b;
          const data = structuredClone(b.data) as Record<string, unknown>;
          const parts = String(m.field).split(".");
          if (parts.length === 1) setLoc(data, parts[0]);
          else if (parts.length === 3 && parts[0] === "items") {
            const arr = data.items as Record<string, unknown>[] | undefined;
            const idx = Number(parts[1]);
            if (Array.isArray(arr) && arr[idx]) setLoc(arr[idx], parts[2]);
          }
          return { ...b, data };
        }),
      }));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inlineEdit]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
    ui.toast("Block duplicated");
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= page.blocks.length) return;
    setBlocks(arrayMove(page.blocks, i, j));
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = page.blocks.findIndex((b) => b.id === active.id);
    const to = page.blocks.findIndex((b) => b.id === over.id);
    if (from !== -1 && to !== -1) setBlocks(arrayMove(page.blocks, from, to));
  }

  const save = useCallback(
    async (opts?: { silent?: boolean }) => {
      const snapshot = serialize(page);
      setSaveState("saving");
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
          // Empty object (not undefined) so turning per-locale HTML off actually clears it.
          rawHtmlI18n: page.rawHtmlI18n ?? {},
          hideChrome: !!page.hideChrome,
          seo: page.seo ?? {},
          ab: page.ab ?? { headlines: [] },
          publishAt: page.publishAt ?? null,
        }),
      });
      if (res.ok) {
        savedRef.current = snapshot;
        setSaveState("saved");
        setPreviewKey((k) => k + 1);
        router.refresh();
        if (!opts?.silent) ui.toast("Page saved", "success");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } else {
        setSaveState("error");
        ui.toast("Save failed", "error");
      }
    },
    [page, router, ui],
  );

  // Debounced autosave.
  useEffect(() => {
    if (!autosave || !dirty || saveState === "saving") return;
    const t = setTimeout(() => save({ silent: true }), 1400);
    return () => clearTimeout(t);
  }, [autosave, dirty, saveState, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function translate() {
    const to: Locale = locale === "en" ? "fr" : "en";
    if (!(await ui.confirm({ title: `Translate to ${to.toUpperCase()}?`, message: `AI will fill the ${to.toUpperCase()} version from your ${locale.toUpperCase()} content. Your ${locale.toUpperCase()} text is not changed.`, confirmLabel: "Translate" }))) return;
    // Save any pending edits first so the translation runs on the latest content.
    if (dirty) await save({ silent: true });
    ui.toast(`Translating to ${to.toUpperCase()}…`);
    const res = await fetch("/api/admin/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: page.id, from: locale, to }),
    });
    if (res.ok) {
      const d = await res.json();
      setPage((p) => ({ ...p, ...d.page }));
      savedRef.current = serialize({ ...page, ...d.page });
      setLocale(to);
      setPreviewKey((k) => k + 1);
      ui.toast("Translation added", "success");
    } else {
      const d = await res.json().catch(() => ({}));
      ui.toast(d.error || "Translation failed", "error");
    }
  }

  async function openHistory() {
    setHistory([]);
    const res = await fetch(`/api/admin/pages/${page.id}/revisions`);
    if (res.ok) setHistory((await res.json()).revisions);
  }
  async function restore(revisionId: string) {
    if (!(await ui.confirm({ title: "Restore this version?", message: "Your current content is saved to history first, so you can undo this.", confirmLabel: "Restore" }))) return;
    const res = await fetch(`/api/admin/pages/${page.id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionId }),
    });
    if (res.ok) {
      ui.toast("Version restored", "success");
      window.location.reload();
    } else ui.toast("Restore failed", "error");
  }

  const publicPath = `/${locale}/${page.slug}`;
  const statusText = saveState === "saving" ? "Saving…" : dirty ? "Unsaved changes" : saveState === "error" ? "Save failed" : "All changes saved";
  const statusTone = saveState === "saving" ? "text-ink-soft" : dirty ? "text-amber-600" : saveState === "error" ? "text-red-600" : "text-green-600";

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
            <span className={`hidden items-center gap-1.5 text-xs font-medium sm:flex ${statusTone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${saveState === "saving" ? "animate-pulse bg-ink-soft" : dirty ? "bg-amber-500" : "bg-green-500"}`} />
              {statusText}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden cursor-pointer items-center gap-1.5 text-xs text-ink-soft xl:flex" title="Automatically save changes">
              <input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />
              Autosave
            </label>
            <div className="flex items-center gap-1 rounded-full border border-line p-0.5 text-sm">
              {contentLocales.map((l) => (
                <button key={l} onClick={() => setLocale(l)} title={staleLocales.includes(l) ? "Translation may be outdated — the source changed. Re-translate to refresh." : undefined} className={`rounded-full px-3 py-1 ${locale === l ? "bg-accent-soft font-semibold text-accent-dark" : "text-ink-soft"}`}>
                  {l.toUpperCase()}
                  {staleLocales.includes(l) && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" title="Outdated translation" />}
                </button>
              ))}
            </div>
            <button onClick={translate} className="btn-secondary hidden py-2 text-sm lg:inline-flex" title="Translate this page with AI" aria-label="Translate this page with AI">
              <Icon name="star" size={15} /> Translate
            </button>
            {page.status === "draft" && (
              <button
                onClick={async () => {
                  const r = await fetch(`/api/admin/pages/${page.id}/preview-link`);
                  const d = await r.json().catch(() => ({}));
                  if (!r.ok) return ui.toast(d.error || "Couldn't create the link", "error");
                  const url = `${window.location.origin}/${locale}/${d.path.replace(/^\//, "")}`;
                  await navigator.clipboard?.writeText(url);
                  ui.toast("Preview link copied — anyone with it can view this draft", "success");
                }}
                className="btn-secondary hidden py-2 text-sm lg:inline-flex"
                title="Copy a shareable link that shows this draft without logging in"
              >
                <Icon name="arrow-up-right" size={15} /> Preview link
              </button>
            )}
            <button onClick={openHistory} className="btn-secondary hidden py-2 text-sm lg:inline-flex" title="Version history" aria-label="Version history">
              <Icon name="refresh" size={15} /> History
            </button>
            <button onClick={() => setPreview((p) => !p)} className={`hidden py-2 text-sm lg:inline-flex ${preview ? "btn-dark" : "btn-secondary"}`}>
              <Icon name="image" size={15} /> Preview
            </button>
            <button
              onClick={() => { setInlineEdit((v) => !v); setPreview(true); setPreviewKey((k) => k + 1); }}
              className={`hidden py-2 text-sm lg:inline-flex ${inlineEdit ? "btn-dark" : "btn-secondary"}`}
              title="Edit text directly on the live preview — click any text and type. Your design is untouched; only text changes are saved."
            >
              <Icon name="edit" size={15} /> Edit on page
            </button>
            <a href={publicPath} target="_blank" rel="noopener noreferrer" className="btn-secondary py-2 text-sm">
              <Icon name="arrow-up-right" size={15} /> View
            </a>
            <button onClick={() => save()} disabled={saveState === "saving" || !dirty} className="btn-primary py-2 text-sm">
              {saveState === "saving" ? "Saving…" : "Save"}
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
                  {page.status === "draft" && (
                    <span className="mt-2 block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Publish automatically at (optional)</span>
                      <input
                        type="datetime-local"
                        className="field"
                        value={page.publishAt ? toLocalInput(page.publishAt) : ""}
                        onChange={(e) => patch({ publishAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      />
                      {page.publishAt && <span className="mt-1 block text-xs text-blue-700">Scheduled — goes live {new Date(page.publishAt).toLocaleString()}</span>}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Page type</span>
                  <select
                    className="field"
                    value={page.mode ?? "blocks"}
                    onChange={(e) => {
                      const mode = e.target.value as Page["mode"];
                      // Blogger/WP-style "edit as HTML": converting a block page
                      // pre-fills the source from the blocks. Blocks are kept, so
                      // switching back restores the visual builder untouched.
                      if (mode === "html" && !(page.rawHtml ?? "").trim() && page.blocks.length > 0) {
                        patch({ mode, rawHtml: blocksToHtml(page.blocks, locale) });
                        ui.toast("Converted your blocks to editable HTML — switch back anytime, the blocks are kept.", "success");
                      } else {
                        patch({ mode });
                      }
                    }}
                  >
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
                {isHtml && (
                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={perLocale}
                      onChange={(e) =>
                        // On: seed each language from the shared HTML so nothing is lost.
                        // Off: drop the per-locale map back to a single shared rawHtml.
                        patch(
                          e.target.checked
                            ? { rawHtmlI18n: Object.fromEntries(contentLocales.map((l) => [l, page.rawHtml ?? ""])) }
                            : { rawHtmlI18n: undefined },
                        )
                      }
                    />
                    <span className="text-sm text-ink">Different HTML per language {perLocale && <span className="text-ink-soft">— editing {locale.toUpperCase()} (switch language above)</span>}</span>
                  </label>
                )}
                {!isHtml && (
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-ink">A/B headline test</span>
                    <textarea
                      className="field min-h-[70px] text-sm"
                      placeholder={"One headline per line (2+ to run a test).\nEach visitor sees one at random; conversions are tracked per variant."}
                      value={(page.ab?.headlines ?? []).join("\n")}
                      onChange={(e) => patch({ ab: { headlines: e.target.value.split("\n").map((h) => h.trim()).filter(Boolean) } })}
                    />
                    <span className="mt-1 block text-xs text-ink-soft">Replaces the first hero/header headline. Results in the dashboard report.</span>
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
                    placeholder="e.g. block cms, edge, self-hosted"
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
                  <h3 className="font-display font-bold text-brand">HTML source{perLocale && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-dark">{locale.toUpperCase()}</span>}</h3>
                  <label className="btn-secondary cursor-pointer py-1.5 text-xs">
                    <Icon name="download" size={13} /> Replace with file
                    <input
                      type="file"
                      accept=".html,.htm"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setHtmlFor(locale, await f.text());
                      }}
                    />
                  </label>
                </div>
                <CodeEditor
                  key={perLocale ? `html-${locale}` : "html-shared"}
                  value={htmlFor(locale)}
                  onChange={(v) => setHtmlFor(locale, v)}
                  minHeight={480}
                  ariaLabel="Page HTML source"
                  placeholder="<!doctype html>… paste or write your HTML here"
                />
                <p className="mt-2 text-xs text-ink-soft">
                  Full documents keep their own CSS/JS and render isolated. Fragments are styled by the site theme.
                </p>
              </div>
            ) : (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={page.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {page.blocks.map((block, i) => (
                        <SortableBlock key={block.id} id={block.id}>
                          <BlockEditor
                            block={block}
                            locale={locale}
                            index={i}
                            total={page.blocks.length}
                            onChange={(b) => updateBlock(i, b)}
                            onDelete={() => setBlocks(page.blocks.filter((_, k) => k !== i))}
                            onDuplicate={() => duplicateBlock(i)}
                            onMove={(dir) => moveBlock(i, dir)}
                          />
                        </SortableBlock>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {page.blocks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink-soft">
                    No blocks yet — add your first section below.
                  </p>
                )}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {inlineEdit ? <span className="text-accent-dark">✎ Editing on page — click any text</span> : "Live preview — saved version"}
                </p>
                <button onClick={() => setPreviewKey((k) => k + 1)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-dark hover:underline">
                  <Icon name="refresh" size={13} /> Refresh
                </button>
              </div>
              {inlineEdit && isHtml ? (
                <iframe ref={previewRef} key={`edit-${locale}-${previewKey}`} srcDoc={buildHtmlEditDoc(htmlFor(locale), locale)} title="Preview" className="h-[calc(100%-2.4rem)] w-full border-0" />
              ) : (
                <iframe ref={previewRef} key={`${previewKey}-${inlineEdit ? "e" : "v"}`} src={inlineEdit ? `${publicPath}?epedit=1` : publicPath} title="Preview" className="h-[calc(100%-2.4rem)] w-full border-0" />
              )}
            </div>
          </div>
        )}
      </div>

      {history !== null && (
        <Modal title="Version history" onClose={() => setHistory(null)}>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">No earlier versions yet. Each save adds one.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{new Date(r.at).toLocaleString()}</p>
                    <p className="truncate text-xs text-ink-soft">{r.title}</p>
                  </div>
                  <button onClick={() => restore(r.id)} className="btn-secondary shrink-0 py-1.5 text-xs">Restore</button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Sortable wrapper: adds a drag handle on the left and reorders on drag. */
function SortableBlock({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group/sort relative ${isDragging ? "z-10 opacity-80" : ""}`}>
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        className="absolute -left-2 top-3 z-10 hidden h-7 w-6 cursor-grab touch-none place-items-center rounded text-ink-soft opacity-0 transition hover:bg-sand hover:text-ink active:cursor-grabbing group-hover/sort:opacity-100 sm:grid"
      >
        <Icon name="grip" size={16} />
      </button>
      {children}
    </div>
  );
}
