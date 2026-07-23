"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MediaField } from "./MediaField";
import { RichText } from "./RichText";
import { CodeEditor } from "./CodeEditor";
import type { Post } from "@/lib/cms-types";
import type { Locale } from "@/i18n/config";

/** ISO → the local-time string a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function PostEditor({ initial, uiLocale, contentLocales = ["en", "fr"] }: { initial: Post; uiLocale: Locale; contentLocales?: string[] }) {
  const router = useRouter();
  const [post, setPost] = useState<Post>(initial);
  const [locale, setLocale] = useState<Locale>("en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sourceView, setSourceView] = useState(false);
  const patch = (p: Partial<Post>) => setPost({ ...post, ...p });

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...post, publishAt: post.publishAt ?? null }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <style dangerouslySetInnerHTML={{ __html: "body>header,body>footer{display:none!important}" }} />
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Link href={`/${uiLocale}/admin`} className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-brand">
            <Icon name="arrow-left" size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-line p-0.5 text-sm">
              {contentLocales.map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={`rounded-full px-3 py-1 ${locale === l ? "bg-accent-soft font-semibold text-accent-dark" : "text-ink-soft"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving} className="btn-primary py-2 text-sm">{saving ? "Saving…" : saved ? "Saved ✓" : "Save"}</button>
          </div>
        </div>
      </header>

      <div className="container-page max-w-3xl space-y-4 py-6">
        <div className="card space-y-3 p-5">
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Title ({locale.toUpperCase()})</span><input className="field" value={post.title[locale]} onChange={(e) => patch({ title: { ...post.title, [locale]: e.target.value } })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Slug</span><input className="field" value={post.slug} onChange={(e) => patch({ slug: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Date</span><input type="date" className="field" value={post.date} onChange={(e) => patch({ date: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Author</span><input className="field" value={post.author} onChange={(e) => patch({ author: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Status</span><select className="field" value={post.status} onChange={(e) => patch({ status: e.target.value as Post["status"] })}><option value="published">Published</option><option value="draft">Draft</option></select></label>
          </div>
          {post.status === "draft" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Publish automatically at (optional)</span>
              <input
                type="datetime-local"
                className="field"
                value={post.publishAt ? toLocalInput(post.publishAt) : ""}
                onChange={(e) => patch({ publishAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
              {post.publishAt && <span className="mt-1 block text-xs text-blue-700">Scheduled — goes live {new Date(post.publishAt).toLocaleString()}</span>}
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Categories</span>
              <input className="field" placeholder="news, guides (comma-separated)" defaultValue={(post.categories ?? []).join(", ")}
                onChange={(e) => patch({ categories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Tags</span>
              <input className="field" placeholder="nextjs, seo (comma-separated)" defaultValue={(post.tags ?? []).join(", ")}
                onChange={(e) => patch({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </label>
          </div>
          <div><span className="mb-1 block text-sm font-medium text-ink">Cover image</span><MediaField value={post.cover} onChange={(v) => patch({ cover: v })} /></div>
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Excerpt ({locale.toUpperCase()})</span><textarea className="field min-h-[70px]" value={post.excerpt[locale]} onChange={(e) => patch({ excerpt: { ...post.excerpt, [locale]: e.target.value } })} /></label>
        </div>
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="block text-sm font-medium text-ink">Body ({locale.toUpperCase()})</span>
            {/* Blogger/WP-style source toggle: edit the exact HTML of the post. */}
            <div className="flex items-center gap-1 rounded-full border border-line p-0.5 text-xs">
              <button type="button" onClick={() => setSourceView(false)} className={`rounded-full px-2.5 py-1 ${!sourceView ? "bg-accent-soft font-semibold text-accent-dark" : "text-ink-soft"}`}>Visual</button>
              <button type="button" onClick={() => setSourceView(true)} className={`rounded-full px-2.5 py-1 ${sourceView ? "bg-accent-soft font-semibold text-accent-dark" : "text-ink-soft"}`}>HTML</button>
            </div>
          </div>
          {sourceView ? (
            <CodeEditor
              value={post.body[locale] ?? ""}
              onChange={(html) => patch({ body: { ...post.body, [locale]: html } })}
              minHeight={320}
              ariaLabel={`Post body HTML (${locale})`}
              placeholder="<p>Write the post body as HTML…</p>"
            />
          ) : (
            <RichText key={locale} value={post.body[locale]} onChange={(html) => patch({ body: { ...post.body, [locale]: html } })} locale={locale} />
          )}
        </div>
      </div>
    </div>
  );
}
