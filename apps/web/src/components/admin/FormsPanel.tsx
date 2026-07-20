"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

type FormFieldType = "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox";
interface FormField { key: string; label: string; type: FormFieldType; required?: boolean; placeholder?: string; options?: string[] }
interface FormDef { id: string; slug: string; name: string; fields: FormField[]; submitLabel: string; successMessage: string }
interface Submission { id: string; data: Record<string, unknown>; createdAt: string }

const TYPES: FormFieldType[] = ["text", "email", "tel", "textarea", "number", "select", "checkbox"];

export function FormsPanel() {
  const ui = useAdminUI();
  const [forms, setForms] = useState<FormDef[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/forms");
    const data = await res.json().catch(() => ({ forms: [] }));
    setForms(data.forms ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const current = forms.find((f) => f.slug === active) ?? null;

  async function del(slug: string) {
    if (!(await ui.confirm({ title: "Delete this form?", message: "Its submissions are removed too.", danger: true, confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/admin/forms/${slug}`, { method: "DELETE" });
    if (res.ok) { ui.toast("Form deleted", "success"); setActive(null); load(); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {forms.map((f) => (
          <button key={f.slug} onClick={() => { setActive(f.slug); setBuilding(false); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${active === f.slug && !building ? "bg-brand text-white" : "bg-surface-soft text-ink-soft hover:text-ink"}`}>
            {f.name}
          </button>
        ))}
        <button onClick={() => { setBuilding(true); setActive(null); }} className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-surface-soft">+ New form</button>
      </div>

      {loading && <p className="text-sm text-ink-soft">Loading…</p>}

      {building && <FormBuilder onDone={(slug) => { setBuilding(false); load().then(() => slug && setActive(slug)); }} onCancel={() => setBuilding(false)} />}

      {!building && !loading && forms.length === 0 && (
        <div className="card p-8 text-center">
          <h3 className="font-display font-semibold text-brand">No forms yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Build contact, signup, or survey forms, collect submissions, export to CSV, and embed anywhere.</p>
          <button onClick={() => setBuilding(true)} className="btn-primary mt-4">Create your first form</button>
        </div>
      )}

      {!building && current && <FormDetail key={current.slug} form={current} onDelete={() => del(current.slug)} />}
    </div>
  );
}

function FormBuilder({ onDone, onCancel }: { onDone: (slug?: string) => void; onCancel: () => void }) {
  const ui = useAdminUI();
  const [name, setName] = useState("");
  const [submitLabel, setSubmitLabel] = useState("Send");
  const [successMessage, setSuccessMessage] = useState("Thanks — we'll be in touch.");
  const [fields, setFields] = useState<FormField[]>([
    { key: "name", label: "Name", type: "text", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "message", label: "Message", type: "textarea" },
  ]);
  const [saving, setSaving] = useState(false);

  const setField = (i: number, patch: Partial<FormField>) => setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  async function save() {
    if (!name.trim()) return ui.toast("Name the form", "error");
    setSaving(true);
    const res = await fetch("/api/admin/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, fields, submitLabel, successMessage }) });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) { ui.toast("Form created", "success"); onDone(data.form?.slug); }
    else ui.toast(data.error || "Couldn't create", "error");
  }

  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-semibold text-brand">New form</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink-soft">Name</span><input className="field" placeholder="e.g. Contact" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink-soft">Submit button label</span><input className="field" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} /></label>
      </div>
      <label className="mt-3 block"><span className="mb-1.5 block text-sm font-medium text-ink-soft">Success message</span><input className="field" value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} /></label>

      <p className="mt-6 text-sm font-semibold text-ink">Fields</p>
      <div className="mt-2 space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input className="field" placeholder="Label" value={f.label} onChange={(e) => setField(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") })} />
            <select className="field" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FormFieldType })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft"><input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> required</label>
            <button type="button" onClick={() => setFields((x) => x.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-red-600">Remove</button>
            {f.type === "select" && <input className="field sm:col-span-4" placeholder="Options, comma-separated" defaultValue={(f.options ?? []).join(", ")} onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setFields((f) => [...f, { key: "", label: "", type: "text" }])} className="mt-3 text-sm font-semibold text-brand">+ Add field</button>

      <div className="mt-6 flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Creating…" : "Create form"}</button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

function FormDetail({ form, onDelete }: { form: FormDef; onDelete: () => void }) {
  const ui = useAdminUI();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [showEmbed, setShowEmbed] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/forms/${form.slug}/submissions`);
    if (res.ok) setSubs((await res.json()).submissions ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [form.slug]);

  async function delSub(id: string) {
    const res = await fetch(`/api/admin/forms/${form.slug}/submissions?id=${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const embed = buildEmbed(form);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-brand">{form.name}</h3>
          <p className="text-xs text-ink-soft">POST to <code className="rounded bg-surface-soft px-1">/api/forms/{form.slug}</code> · {subs.length} submission{subs.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowEmbed((s) => !s)} className="btn-secondary">{showEmbed ? "Hide embed" : "Embed code"}</button>
          <a href={`/api/admin/forms/${form.slug}/submissions?format=csv`} className="btn-secondary">Export CSV</a>
          <button onClick={onDelete} className="btn-secondary text-red-600">Delete form</button>
        </div>
      </div>

      {showEmbed && (
        <div className="mt-4 rounded-lg border border-line p-4">
          <p className="text-sm text-ink-soft">Paste this anywhere — an HTML page here, or any external site:</p>
          <textarea readOnly className="field mt-2 min-h-[140px] font-mono text-xs" value={embed} onFocus={(e) => e.currentTarget.select()} />
          <button onClick={() => { navigator.clipboard?.writeText(embed); ui.toast("Embed copied", "success"); }} className="mt-2 text-xs font-semibold text-brand">Copy</button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase text-ink-soft">
            <tr>{form.fields.map((f) => <th key={f.key} className="py-2 pr-4">{f.label}</th>)}<th className="py-2 pr-4">When</th><th></th></tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                {form.fields.map((f) => <td key={f.key} className="py-2.5 pr-4">{String(s.data[f.key] ?? "")}</td>)}
                <td className="py-2.5 pr-4 text-ink-soft">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="py-2.5 text-right"><button onClick={() => delSub(s.id)} className="text-xs font-semibold text-red-600">Delete</button></td>
              </tr>
            ))}
            {subs.length === 0 && <tr><td colSpan={form.fields.length + 2} className="py-8 text-center text-ink-soft">No submissions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A self-contained HTML+JS snippet that renders the form and posts to the API. */
function buildEmbed(form: FormDef): string {
  const inputs = form.fields.map((f) => {
    const req = f.required ? " required" : "";
    if (f.type === "textarea") return `    <label>${f.label}<textarea name="${f.key}"${req}></textarea></label>`;
    if (f.type === "checkbox") return `    <label><input type="checkbox" name="${f.key}"${req}> ${f.label}</label>`;
    if (f.type === "select") return `    <label>${f.label}<select name="${f.key}"${req}>${(f.options ?? []).map((o) => `<option>${o}</option>`).join("")}</select></label>`;
    const t = f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "number" ? "number" : "text";
    return `    <label>${f.label}<input type="${t}" name="${f.key}"${req}></label>`;
  }).join("\n");
  return `<form id="ep-${form.slug}">
${inputs}
    <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off">
    <button type="submit">${form.submitLabel}</button>
    <p class="ep-msg"></p>
</form>
<script>
document.getElementById("ep-${form.slug}").addEventListener("submit", async function(e){
  e.preventDefault();
  var f = e.target, d = {};
  new FormData(f).forEach(function(v,k){ d[k] = v; });
  f.querySelectorAll('input[type=checkbox]').forEach(function(c){ d[c.name] = c.checked; });
  var res = await fetch("/api/forms/${form.slug}", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(d) });
  var j = await res.json();
  f.querySelector(".ep-msg").textContent = res.ok ? (j.message || "Thanks!") : (j.error || "Something went wrong");
  if (res.ok) f.reset();
});
</script>`;
}
