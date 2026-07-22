"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAdminUI } from "./ui";
import type { MediaItem } from "@/lib/cms-types";

export function MediaLibrary({ onPick }: { onPick?: (url: string) => void }) {
  const ui = useAdminUI();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [altBusy, setAltBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MediaItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function search() {
    if (!q.trim()) { setResults(null); return; }
    setSearching(true);
    const res = await fetch("/api/admin/media/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
    if (res.ok) { const d = await res.json(); setResults(d.media); if (!d.semantic && d.media.length === 0) ui.toast("No matches — try 'Build search index' for semantic search", "info"); }
    setSearching(false);
  }
  async function reindex() {
    ui.toast("Building search index…");
    const res = await fetch("/api/admin/media/reindex", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    ui.toast(res.ok ? `Indexed ${d.indexed} item(s) for semantic search` : (d.error || "Reindex failed"), res.ok ? "success" : "error");
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/media");
    if (res.ok) setItems((await res.json()).media);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      if (res.ok) {
        const { item } = await res.json();
        setItems((prev) => [item, ...prev]);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Upload failed");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(id: string) {
    if (!(await ui.confirm({ title: "Delete file?", message: "This file will be permanently removed from storage.", confirmLabel: "Delete", danger: true }))) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    ui.toast("File deleted", "success");
  }

  async function genImage() {
    const prompt = await ui.prompt({
      title: "Generate an image with AI",
      message: "Describe the image — it's created and added to your library (free, on Workers AI).",
      label: "Prompt",
      placeholder: "e.g. a sunlit modern kitchen, wide angle, photorealistic",
      confirmLabel: "Generate",
    });
    if (!prompt) return;
    setUploading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/ai/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const d = await r.json();
      if (r.ok) {
        setItems((prev) => [d.item, ...prev]);
        ui.toast("Image generated", "success");
      } else ui.toast(d.error || "Generation failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function imageOp(id: string, op: "remove-bg" | "upscale") {
    setAltBusy(id);
    ui.toast(op === "remove-bg" ? "Removing background…" : "Upscaling…");
    try {
      const r = await fetch("/api/admin/ai/image-ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, op }) });
      const d = await r.json();
      if (r.ok) {
        setItems((prev) => [d.item, ...prev]);
        ui.toast("Done — added as a new image", "success");
      } else ui.toast(d.error || "Image operation failed", "error");
    } finally {
      setAltBusy(null);
    }
  }

  async function transcribeItem(id: string) {
    setAltBusy(id);
    try {
      const r = await fetch("/api/admin/ai/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const d = await r.json();
      if (r.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, alt: d.text } : i)));
        ui.toast(d.text ? "Transcribed" : "No speech detected", d.text ? "success" : "info");
      } else ui.toast(d.error || "Transcription failed", "error");
    } finally {
      setAltBusy(null);
    }
  }

  async function genAlt(id: string) {
    setAltBusy(id);
    try {
      const r = await fetch("/api/admin/ai/alt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const d = await r.json();
      if (r.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, alt: d.alt } : i)));
        ui.toast("Alt text generated", "success");
      } else ui.toast(d.error || "Alt generation failed", "error");
    } finally {
      setAltBusy(null);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-sand p-6 text-center"
      >
        <Icon name="download" size={26} className="text-ink-soft" />
        <p className="mt-2 text-sm text-ink-soft">Drag &amp; drop images or videos here, or</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary py-2 text-sm">
            {uploading ? "Working…" : "Choose files"}
          </button>
          <button type="button" onClick={genImage} disabled={uploading} className="btn-secondary py-2 text-sm">
            <Icon name="star" size={14} /> Generate with AI
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        <p className="mt-2 text-xs text-ink-soft">Images up to 8MB · videos (MP4/WebM) up to 90MB</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 gap-2">
          <input
            className="field"
            placeholder="Search media by meaning — e.g. 'bright kitchen'"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button type="button" onClick={search} disabled={searching} className="btn-secondary shrink-0">{searching ? "Searching…" : "Search"}</button>
          {results !== null && <button type="button" onClick={() => { setQ(""); setResults(null); }} className="btn-secondary shrink-0">Clear</button>}
        </div>
        <button type="button" onClick={reindex} className="btn-secondary shrink-0" title="Embed all media for semantic search">Build search index</button>
      </div>

      {loading ? (
        <p className="mt-6 text-center text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(results ?? items).map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-lg border border-line bg-white">
              {m.kind === "video" ? (
                <video src={m.url} muted playsInline preload="metadata" className="aspect-square w-full bg-brand-dark object-cover" />
              ) : m.kind === "audio" ? (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-brand-dark p-3">
                  <Icon name="star" size={22} className="text-accent" />
                  <audio src={m.url} controls className="w-full" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.filename} className="aspect-square w-full object-cover" />
              )}
              {(m.kind === "video" || m.kind === "audio") && (
                <span className="absolute left-1.5 top-1.5 rounded bg-brand-dark/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{m.kind}</span>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-end gap-2 p-2 opacity-0 transition group-hover:opacity-100 group-hover:pointer-events-auto">
                {onPick && m.kind === "image" && (
                  <button type="button" onClick={() => onPick(m.url)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-brand-dark">
                    Use
                  </button>
                )}
                {m.kind === "image" && (
                  <>
                    <button type="button" onClick={() => genAlt(m.id)} disabled={altBusy === m.id} className="rounded-lg bg-white/90 p-1.5 text-brand" title="Generate alt text with AI">
                      <Icon name="star" size={15} />
                    </button>
                    <button type="button" onClick={() => imageOp(m.id, "remove-bg")} disabled={altBusy === m.id} className="rounded-lg bg-white/90 px-2 py-1.5 text-[10px] font-bold text-brand" title="Remove background (needs a Replicate key in the AI panel)">
                      BG
                    </button>
                    <button type="button" onClick={() => imageOp(m.id, "upscale")} disabled={altBusy === m.id} className="rounded-lg bg-white/90 px-2 py-1.5 text-[10px] font-bold text-brand" title="Upscale 2× (needs a Replicate key in the AI panel)">
                      2×
                    </button>
                  </>
                )}
                {(m.kind === "audio" || m.kind === "video") && (
                  <button type="button" onClick={() => transcribeItem(m.id)} disabled={altBusy === m.id} className="rounded-lg bg-white/90 px-2 py-1.5 text-xs font-semibold text-brand" title="Transcribe with AI (Whisper)">
                    {altBusy === m.id ? "…" : "Transcribe"}
                  </button>
                )}
                <button type="button" onClick={() => remove(m.id)} className="rounded-lg bg-white/90 p-1.5 text-red-600" title="Delete">
                  <Icon name="trash" size={15} />
                </button>
              </div>
              {m.alt && <p className="truncate px-2 py-1 text-[10px] text-ink-soft" title={m.alt}>{m.kind === "image" ? "alt" : "transcript"}: {m.alt}</p>}
            </div>
          ))}
          {(results ?? items).length === 0 && <p className="col-span-full text-center text-sm text-ink-soft">{results !== null ? "No matches." : "No media yet."}</p>}
        </div>
      )}
    </div>
  );
}
