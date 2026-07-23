"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

type FormFieldType = "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "file";
interface FormField { key: string; label: string; type: FormFieldType; required?: boolean; placeholder?: string; options?: string[]; pattern?: string; min?: number; max?: number; step?: number; showIf?: { field: string; equals: string } }
interface FormDef { id: string; slug: string; name: string; fields: FormField[]; submitLabel: string; successMessage: string; notifyEmail?: string }
interface Submission { id: string; data: Record<string, unknown>; createdAt: string; spam?: boolean }

const TYPES: FormFieldType[] = ["text", "email", "tel", "textarea", "number", "select", "checkbox", "file"];

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
  const [notifyEmail, setNotifyEmail] = useState("");
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
    const res = await fetch("/api/admin/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, fields, submitLabel, successMessage, notifyEmail: notifyEmail.trim() || undefined }) });
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
      <label className="mt-3 block"><span className="mb-1.5 block text-sm font-medium text-ink-soft">Email new submissions to (optional)</span><input type="email" className="field" placeholder="you@company.com" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} /></label>

      <p className="mt-6 text-sm font-semibold text-ink">Fields</p>
      <div className="mt-2 space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input className="field" placeholder="Label" value={f.label} onChange={(e) => setField(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") })} />
            <select className="field" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FormFieldType })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft"><input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> required</label>
            <button type="button" onClick={() => setFields((x) => x.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-red-600">Remove</button>
            {f.type === "select" && <input className="field sm:col-span-4" placeholder="Options, comma-separated" defaultValue={(f.options ?? []).join(", ")} onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />}
            {f.type !== "select" && f.type !== "checkbox" && f.type !== "file" && (
              <div className="grid gap-2 sm:col-span-4 sm:grid-cols-[2fr_1fr_1fr]">
                {f.type !== "number" && f.type !== "email" ? (
                  <input className="field text-xs" placeholder="Pattern (regex, optional) e.g. ^[A-Z]{2}\d{4}$" value={f.pattern ?? ""} onChange={(e) => setField(i, { pattern: e.target.value || undefined })} />
                ) : <span className="hidden sm:block" />}
                <input className="field text-xs" type="number" placeholder={f.type === "number" ? "Min value" : "Min length"} value={f.min ?? ""} onChange={(e) => setField(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} />
                <input className="field text-xs" type="number" placeholder={f.type === "number" ? "Max value" : "Max length"} value={f.max ?? ""} onChange={(e) => setField(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </div>
            )}
            <div className="grid gap-2 sm:col-span-4 sm:grid-cols-[100px_1fr_1fr]">
              <input className="field text-xs" type="number" min={1} max={10} placeholder="Step (1)" title="Multi-step: which step this field is on" value={f.step ?? ""} onChange={(e) => setField(i, { step: e.target.value === "" ? undefined : Number(e.target.value) })} />
              <select className="field text-xs" title="Only show this field when another field has a value" value={f.showIf?.field ?? ""} onChange={(e) => setField(i, { showIf: e.target.value ? { field: e.target.value, equals: f.showIf?.equals ?? "" } : undefined })}>
                <option value="">Always shown</option>
                {fields.filter((_, k) => k !== i).map((o) => o.key && <option key={o.key} value={o.key}>Show if “{o.label || o.key}” equals…</option>)}
              </select>
              {f.showIf && <input className="field text-xs" placeholder="…this value (checkbox: true/false)" value={f.showIf.equals} onChange={(e) => setField(i, { showIf: { field: f.showIf!.field, equals: e.target.value } })} />}
            </div>
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
  const [notifyEmail, setNotifyEmail] = useState(form.notifyEmail ?? "");

  async function saveNotify() {
    const res = await fetch(`/api/admin/forms/${form.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifyEmail: notifyEmail.trim() }) });
    if (res.ok) ui.toast(notifyEmail.trim() ? "Notifications updated" : "Notifications cleared", "success");
    else ui.toast("Couldn't save", "error");
  }

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

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
        <label className="block min-w-[240px] flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Email new submissions to</span>
          <input type="email" className="field" placeholder="you@company.com (blank = default inbox)" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} />
        </label>
        <button onClick={saveNotify} className="btn-secondary text-sm">Save</button>
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
              <tr key={s.id} className={`border-b border-line last:border-0 ${s.spam ? "bg-red-50/60" : ""}`}>
                {form.fields.map((f, fi) => (
                  <td key={f.key} className="py-2.5 pr-4">
                    {fi === 0 && s.spam && <span className="mr-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">spam</span>}
                    {String(s.data[f.key] ?? "")}
                  </td>
                ))}
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

/** A self-contained HTML+JS snippet that renders the form and posts to the API.
 *  Supports multi-step (field.step), conditional fields (field.showIf) and
 *  file uploads (multipart when any file field exists). */
function buildEmbed(form: FormDef): string {
  const hasFiles = form.fields.some((f) => f.type === "file");
  const steps = [...new Set(form.fields.map((f) => f.step ?? 1))].sort((a, b) => a - b);
  const multiStep = steps.length > 1;

  const inputFor = (f: FormField): string => {
    const req = f.required ? " required" : "";
    // Mirror server-side rules as native HTML validation attributes.
    const lenRules = `${f.min !== undefined ? ` minlength="${f.min}"` : ""}${f.max !== undefined ? ` maxlength="${f.max}"` : ""}`;
    const numRules = `${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""}`;
    const pat = f.pattern ? ` pattern="${f.pattern.replace(/"/g, "&quot;")}"` : "";
    if (f.type === "textarea") return `<label>${f.label}<textarea name="${f.key}"${req}${lenRules}></textarea></label>`;
    if (f.type === "checkbox") return `<label><input type="checkbox" name="${f.key}"${req}> ${f.label}</label>`;
    if (f.type === "select") return `<label>${f.label}<select name="${f.key}"${req}>${(f.options ?? []).map((o) => `<option>${o}</option>`).join("")}</select></label>`;
    if (f.type === "file") return `<label>${f.label}<input type="file" name="${f.key}"${req} accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"></label>`;
    const t = f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "number" ? "number" : "text";
    return `<label>${f.label}<input type="${t}" name="${f.key}"${req}${t === "number" ? numRules : lenRules}${t === "text" || t === "tel" ? pat : ""}></label>`;
  };

  const wrap = (f: FormField): string => {
    const cond = f.showIf ? ` data-ep-showif="${f.showIf.field}" data-ep-equals="${String(f.showIf.equals).replace(/"/g, "&quot;")}"` : "";
    return `    <div${cond}>${inputFor(f)}</div>`;
  };

  const body = multiStep
    ? steps
        .map((s, i) => {
          const fields = form.fields.filter((f) => (f.step ?? 1) === s).map(wrap).join("\n");
          const nav =
            `      <div class="ep-nav">` +
            (i > 0 ? `<button type="button" class="ep-prev">Back</button>` : "") +
            (i < steps.length - 1 ? `<button type="button" class="ep-next">Next</button>` : `<button type="submit">${form.submitLabel}</button>`) +
            `</div>`;
          return `    <fieldset class="ep-step"${i > 0 ? ' style="display:none"' : ""}>\n${fields}\n${nav}\n    </fieldset>`;
        })
        .join("\n")
    : `${form.fields.map(wrap).join("\n")}\n    <button type="submit">${form.submitLabel}</button>`;

  return `<form id="ep-${form.slug}"${hasFiles ? ' enctype="multipart/form-data"' : ""}>
${body}
    <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off">
    <p class="ep-msg"></p>
</form>
<script>
(function(){
  var f = document.getElementById("ep-${form.slug}");
  // Conditional fields: show only when the controlling field matches; hidden
  // fields are disabled so they're neither validated nor submitted.
  function applyConds(){
    f.querySelectorAll("[data-ep-showif]").forEach(function(w){
      var ctrl = f.querySelector('[name="'+w.getAttribute("data-ep-showif")+'"]');
      var val = ctrl ? (ctrl.type === "checkbox" ? String(ctrl.checked) : ctrl.value) : "";
      var show = val === w.getAttribute("data-ep-equals");
      w.style.display = show ? "" : "none";
      w.querySelectorAll("input,select,textarea").forEach(function(i){ i.disabled = !show; });
    });
  }
  f.addEventListener("input", applyConds);
  f.addEventListener("change", applyConds);
  applyConds();
  // Multi-step navigation with per-step native validation.
  var stepEls = f.querySelectorAll(".ep-step");
  function stepValid(el){
    var ok = true;
    el.querySelectorAll("input,select,textarea").forEach(function(i){ if (!i.disabled && !i.checkValidity()) { i.reportValidity(); ok = false; } });
    return ok;
  }
  stepEls.forEach(function(el, idx){
    var next = el.querySelector(".ep-next"), prev = el.querySelector(".ep-prev");
    if (next) next.addEventListener("click", function(){ if (stepValid(el)) { el.style.display = "none"; stepEls[idx+1].style.display = ""; } });
    if (prev) prev.addEventListener("click", function(){ el.style.display = "none"; stepEls[idx-1].style.display = ""; });
  });
  f.addEventListener("submit", async function(e){
    e.preventDefault();
    var res;
    ${hasFiles
      ? `res = await fetch("/api/forms/${form.slug}", { method:"POST", body: new FormData(f) });`
      : `var d = {};
    new FormData(f).forEach(function(v,k){ d[k] = v; });
    f.querySelectorAll("input[type=checkbox]").forEach(function(c){ if (!c.disabled) d[c.name] = c.checked; });
    res = await fetch("/api/forms/${form.slug}", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(d) });`}
    var j = await res.json();
    f.querySelector(".ep-msg").textContent = res.ok ? (j.message || "Thanks!") : (j.error || "Something went wrong");
    if (res.ok) { f.reset(); applyConds(); if (stepEls.length) { stepEls.forEach(function(s,i){ s.style.display = i === 0 ? "" : "none"; }); } }
  });
})();
</script>`;
}
