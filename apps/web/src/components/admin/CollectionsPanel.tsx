"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

type FieldType = "text" | "textarea" | "richtext" | "number" | "boolean" | "date" | "image" | "select" | "relation";
interface Field { key: string; label: string; type: FieldType; required?: boolean; options?: string[]; relatesTo?: string }
interface ContentType { id: string; slug: string; name: string; fields: Field[] }
interface Entry { id: string; slug: string; status: "draft" | "published"; data: Record<string, unknown>; updatedAt: string }

const FIELD_TYPES: FieldType[] = ["text", "textarea", "richtext", "number", "boolean", "date", "image", "select", "relation"];

export function CollectionsPanel({ isSuper }: { isSuper: boolean }) {
  const ui = useAdminUI();
  const [types, setTypes] = useState<ContentType[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadTypes() {
    const res = await fetch("/api/admin/content-types");
    const data = await res.json().catch(() => ({ types: [] }));
    setTypes(data.types ?? []);
    setLoading(false);
    if (!active && data.types?.length) setActive(data.types[0].slug);
  }
  useEffect(() => { loadTypes(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const current = types.find((t) => t.slug === active) ?? null;

  async function deleteType(slug: string) {
    if (!(await ui.confirm({ title: "Delete this content type?", message: "All its entries are removed too. This can't be undone.", danger: true, confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/admin/content-types/${slug}`, { method: "DELETE" });
    if (res.ok) {
      ui.toast("Content type deleted", "success");
      setActive(null);
      loadTypes();
    } else ui.toast("Couldn't delete", "error");
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {types.map((t) => (
          <button key={t.slug} onClick={() => { setActive(t.slug); setBuilding(false); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${active === t.slug && !building ? "bg-brand text-white" : "bg-surface-soft text-ink-soft hover:text-ink"}`}>
            {t.name}
          </button>
        ))}
        {isSuper && (
          <button onClick={() => { setBuilding(true); setActive(null); }} className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-surface-soft">
            + New type
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-ink-soft">Loading…</p>}

      {building && isSuper && (
        <TypeBuilder existingTypes={types} onDone={(slug) => { setBuilding(false); loadTypes().then(() => slug && setActive(slug)); }} onCancel={() => setBuilding(false)} />
      )}

      {!building && !loading && types.length === 0 && (
        <div className="card p-8 text-center">
          <h3 className="font-display font-semibold text-brand">No content types yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            Content types let you model anything — products, team members, events, testimonials — with your own fields, then serve them through the Content API.
          </p>
          {isSuper && <button onClick={() => setBuilding(true)} className="btn-primary mt-4">Create your first type</button>}
          {!isSuper && <p className="mt-3 text-xs text-ink-soft">Ask the site owner to define a content type.</p>}
        </div>
      )}

      {!building && current && (
        <EntriesManager key={current.slug} type={current} isSuper={isSuper} onEditSchema={() => setBuilding(false)} onDeleteType={() => deleteType(current.slug)} onReloadTypes={loadTypes} />
      )}
    </div>
  );
}

// ─── Type builder (define fields) ───────────────────────
function TypeBuilder({ existingTypes, onDone, onCancel }: { existingTypes: ContentType[]; onDone: (slug?: string) => void; onCancel: () => void }) {
  const ui = useAdminUI();
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Field[]>([{ key: "title", label: "Title", type: "text", required: true }]);
  const [saving, setSaving] = useState(false);

  function setField(i: number, patch: Partial<Field>) {
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addField() { setFields((f) => [...f, { key: "", label: "", type: "text" }]); }
  function removeField(i: number) { setFields((f) => f.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!name.trim()) return ui.toast("Give the type a name", "error");
    setSaving(true);
    const res = await fetch("/api/admin/content-types", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fields }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) { ui.toast("Content type created", "success"); onDone(data.type?.slug); }
    else ui.toast(data.error || "Couldn't create type", "error");
  }

  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-semibold text-brand">New content type</h3>
      <label className="mt-4 block max-w-sm">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Name (plural)</span>
        <input className="field" placeholder="e.g. Products" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>

      <p className="mt-6 text-sm font-semibold text-ink">Fields</p>
      <div className="mt-2 space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input className="field" placeholder="Label (e.g. Price)" value={f.label} onChange={(e) => setField(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") })} />
            <select className="field" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType })}>
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-ink-soft whitespace-nowrap">
              <input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> required
            </label>
            <button type="button" onClick={() => removeField(i)} className="text-xs font-semibold text-red-600">Remove</button>
            {f.type === "select" && (
              <input className="field sm:col-span-4" placeholder="Options, comma-separated (e.g. Small, Medium, Large)" defaultValue={(f.options ?? []).join(", ")}
                onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            )}
            {f.type === "relation" && (
              <select className="field sm:col-span-4" value={f.relatesTo ?? ""} onChange={(e) => setField(i, { relatesTo: e.target.value || undefined })}>
                <option value="">Links to… (pick a content type)</option>
                {existingTypes.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addField} className="mt-3 text-sm font-semibold text-brand">+ Add field</button>

      <div className="mt-6 flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Creating…" : "Create type"}</button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

// ─── Entries manager (per type) ─────────────────────────
function EntriesManager({ type, isSuper, onDeleteType, onReloadTypes }: { type: ContentType; isSuper: boolean; onEditSchema: () => void; onDeleteType: () => void; onReloadTypes: () => void }) {
  const ui = useAdminUI();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/content-types/${type.slug}/entries`);
    const data = await res.json().catch(() => ({ entries: [] }));
    setEntries(data.entries ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type.slug]);

  async function remove(entry: Entry) {
    if (!(await ui.confirm({ title: `Delete "${entry.slug}"?`, danger: true, confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/admin/content-types/${type.slug}/entries/${entry.id}`, { method: "DELETE" });
    if (res.ok) { ui.toast("Entry deleted", "success"); load(); }
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const csv = await file.text();
    const res = await fetch(`/api/admin/content-types/${type.slug}/import`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { ui.toast(`Imported ${data.created} entr${data.created === 1 ? "y" : "ies"}`, "success"); load(); }
    else ui.toast(data.error || "Import failed", "error");
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-brand">{type.name}</h3>
          <p className="text-xs text-ink-soft">
            {type.fields.length} field{type.fields.length === 1 ? "" : "s"} · API: <code className="rounded bg-surface-soft px-1">/api/content/{type.slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditing("new")} className="btn-primary">+ New entry</button>
          <a href={`/api/admin/content-types/${type.slug}/entries?format=csv`} className="btn-secondary">Export CSV</a>
          <label className="btn-secondary cursor-pointer">
            Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          </label>
          {isSuper && <button onClick={onDeleteType} className="btn-secondary text-red-600">Delete type</button>}
        </div>
      </div>

      {editing ? (
        <EntryEditor type={type} entry={editing === "new" ? null : editing}
          onSaved={() => { setEditing(null); load(); onReloadTypes(); }} onCancel={() => setEditing(null)} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-ink-soft">
              <tr><th scope="col" className="py-2 pr-4">Slug</th><th scope="col" className="py-2 pr-4">Status</th><th scope="col" className="py-2 pr-4">Updated</th><th scope="col" className="py-2"></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{e.slug}</td>
                  <td className="py-2.5 pr-4"><span className={e.status === "published" ? "font-semibold text-accent-dark" : "text-ink-soft"}>{e.status}</span></td>
                  <td className="py-2.5 pr-4 text-ink-soft">{new Date(e.updatedAt).toLocaleDateString()}</td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => setEditing(e)} className="mr-3 text-xs font-semibold text-brand">Edit</button>
                    <button onClick={() => remove(e)} className="text-xs font-semibold text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-ink-soft">No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Dropdown of the target type's entries (value = entry slug). */
function RelationSelect({ target, value, onChange }: { target: string; value: string; onChange: (v: string) => void }) {
  const [options, setOptions] = useState<{ slug: string; status: string }[]>([]);
  useEffect(() => {
    if (!target) return;
    fetch(`/api/admin/content-types/${target}/entries`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setOptions((d.entries ?? []).map((e: Entry) => ({ slug: e.slug, status: e.status }))))
      .catch(() => setOptions([]));
  }, [target]);
  if (!target) return <p className="text-xs text-red-600">This relation field has no target type — edit the schema.</p>;
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.slug} value={o.slug}>{o.slug}{o.status === "draft" ? " (draft)" : ""}</option>
      ))}
    </select>
  );
}

// ─── Entry editor (renders inputs from the schema) ──────
function EntryEditor({ type, entry, onSaved, onCancel }: { type: ContentType; entry: Entry | null; onSaved: () => void; onCancel: () => void }) {
  const ui = useAdminUI();
  const [data, setData] = useState<Record<string, unknown>>(entry?.data ?? {});
  const [slug, setSlug] = useState(entry?.slug ?? "");
  const [status, setStatus] = useState<"draft" | "published">(entry?.status ?? "draft");
  const [saving, setSaving] = useState(false);

  function set(key: string, value: unknown) { setData((d) => ({ ...d, [key]: value })); }

  async function save() {
    for (const f of type.fields) {
      if (f.required && !String(data[f.key] ?? "").trim()) return ui.toast(`${f.label} is required`, "error");
    }
    setSaving(true);
    const url = entry ? `/api/admin/content-types/${type.slug}/entries/${entry.id}` : `/api/admin/content-types/${type.slug}/entries`;
    const res = await fetch(url, { method: entry ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: slug || undefined, status, data }) });
    setSaving(false);
    if (res.ok) { ui.toast(entry ? "Saved" : "Entry created", "success"); onSaved(); }
    else ui.toast("Couldn't save", "error");
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="grid gap-4 md:grid-cols-2">
        {type.fields.map((f) => (
          <label key={f.key} className={f.type === "textarea" || f.type === "richtext" ? "md:col-span-2 block" : "block"}>
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
            {f.type === "textarea" || f.type === "richtext" ? (
              <textarea className="field min-h-[110px]" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === "boolean" ? (
              <input type="checkbox" checked={!!data[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
            ) : f.type === "select" ? (
              <select className="field" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">—</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "relation" ? (
              <RelationSelect target={f.relatesTo ?? ""} value={String(data[f.key] ?? "")} onChange={(v) => set(f.key, v)} />
            ) : (
              <input className="field" type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={String(data[f.key] ?? "")}
                placeholder={f.type === "image" ? "Image URL or /media/…" : undefined} onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Slug (URL)</span>
          <input className="field" placeholder="auto from first field" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Status</span>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
