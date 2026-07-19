"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { marketDict } from "@/lib/marketplace-i18n";
import { MarketAuthForm } from "./MarketAuthForm";

type Line = { label: string; detail: string; min: string; max: string };

/** "Post a project" form — generic project marketplace version. */
export function NewTenderForm({ locale, signedIn }: { locale: string; signedIn: boolean }) {
  const d = marketDict(locale);
  const m = d.market;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("home");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(signedIn);

  if (!authed) {
    return (
      <div>
        <p className="mb-6 text-center text-sm text-ink-soft">{m.signInFirst}</p>
        <MarketAuthForm locale={locale} onDone={() => setAuthed(true)} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="card p-6 text-center">
        <p className="font-medium">{m.submitted}</p>
        <Link href={`/${locale}/account`} className="btn-secondary mt-4 inline-flex">
          {m.account}
        </Link>
      </div>
    );
  }

  const totals = lines.reduce(
    (acc, l) => ({ min: acc.min + (Number(l.min) || 0), max: acc.max + (Number(l.max) || 0) }),
    { min: 0, max: 0 },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          location,
          description,
          tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
          lines: lines
            .filter((l) => l.label.trim())
            .map((l) => ({ label: l.label, detail: l.detail, min: Number(l.min) || 0, max: Number(l.max) || 0 })),
          totalMin: totals.min,
          totalMax: totals.max,
        }),
      });
      if (res.ok) setDone(true);
      else setError(m.submitError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6">
      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{m.fTitle}</span>
        <input className="field w-full" value={title} placeholder={m.fTitlePh} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-soft">{m.fCategory}</span>
          <select className="field w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(m.categories).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-soft">{m.fLocation}</span>
          <input className="field w-full" value={location} placeholder={m.fLocationPh} onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 mb-3 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{m.fDescription}</span>
        <textarea className="field min-h-[120px] w-full" value={description} placeholder={m.fDescriptionPh} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="mb-4 block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{m.fTags}</span>
        <input className="field w-full" value={tags} placeholder={m.fTagsPh} onChange={(e) => setTags(e.target.value)} />
      </label>

      <p className="mb-2 text-sm font-medium text-ink-soft">{m.fLines}</p>
      {lines.map((l, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_90px_90px_auto] items-center gap-2">
          <input
            className="field"
            value={l.label}
            placeholder={m.fLineLabel}
            onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
          />
          <input
            className="field"
            type="number"
            min="0"
            value={l.min}
            placeholder={m.fLineMin}
            onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))}
          />
          <input
            className="field"
            type="number"
            min="0"
            value={l.max}
            placeholder={m.fLineMax}
            onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)))}
          />
          <button
            type="button"
            onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
            className="text-xs font-semibold text-red-600"
          >
            {m.removeLine}
          </button>
        </div>
      ))}
      {lines.length < 12 && (
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { label: "", detail: "", min: "", max: "" }])}
          className="btn-secondary text-sm"
        >
          {m.addLine}
        </button>
      )}

      {totals.max > 0 && (
        <p className="mt-3 text-sm text-ink-soft">
          {m.budget}: ${totals.min.toLocaleString()} – ${totals.max.toLocaleString()}
        </p>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
        <Icon name="arrow-right" size={18} />
        {m.submit}
      </button>
    </form>
  );
}
