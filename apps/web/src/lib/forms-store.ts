import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { appendLogItem, readWithCompaction } from "./append-log";
import { slugify } from "./content-store";

/**
 * Forms builder. The owner/editor defines a form (typed fields); the public
 * submit endpoint validates + stores submissions, which are viewable and
 * CSV-exportable in the admin. Forms embed anywhere via a copy-paste snippet.
 */

export type FormFieldType = "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox";

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Regex the value must match (text/tel/textarea/email). */
  pattern?: string;
  /** number type: value bounds. String types: length bounds. */
  min?: number;
  max?: number;
}

export interface FormDef {
  id: string;
  slug: string;
  name: string;
  fields: FormField[];
  submitLabel: string;
  successMessage: string;
  createdAt: string;
  /** Each new submission is emailed here (falls back to LEAD_NOTIFY_TO when unset). */
  notifyEmail?: string;
}

export interface Submission {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  /** Heuristic spam flag (non-blocking; owner reviews). */
  spam?: boolean;
}

const FORMS_KEY = "forms.json";
const subsKey = (slug: string) => `form-submissions-${slug}.json`;
const uid = () => randomUUID().slice(0, 8);

function normalizeFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FormField[] = [];
  for (const f of raw) {
    const key = slugify(String((f as FormField)?.key || (f as FormField)?.label || "")).replace(/-/g, "_");
    if (!key || seen.has(key)) continue;
    const type = (["text", "email", "tel", "textarea", "number", "select", "checkbox"] as FormFieldType[]).includes((f as FormField)?.type) ? (f as FormField).type : "text";
    seen.add(key);
    const field: FormField = { key, label: String((f as FormField)?.label || key).slice(0, 80), type };
    if ((f as FormField)?.required) field.required = true;
    if ((f as FormField)?.placeholder) field.placeholder = String((f as FormField).placeholder).slice(0, 120);
    if (type === "select" && Array.isArray((f as FormField).options)) field.options = (f as FormField).options!.map(String).filter(Boolean).slice(0, 40);
    const pattern = (f as FormField)?.pattern;
    if (typeof pattern === "string" && pattern && pattern.length <= 200) {
      try { new RegExp(pattern); field.pattern = pattern; } catch { /* invalid regex — drop */ }
    }
    const num = (v: unknown) => (v === undefined || v === null || String(v).trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));
    const min = num((f as FormField)?.min), max = num((f as FormField)?.max);
    if (min !== undefined) field.min = min;
    if (max !== undefined) field.max = max;
    out.push(field);
  }
  return out.slice(0, 40);
}

// ─── Form definitions ───────────────────────────────────
export async function getForms(): Promise<FormDef[]> {
  return readJsonDoc<FormDef[]>(FORMS_KEY, []);
}
export async function getForm(slug: string): Promise<FormDef | null> {
  return (await getForms()).find((f) => f.slug === slug) ?? null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function createForm(input: { name: string; slug?: string; fields: FormField[]; submitLabel?: string; successMessage?: string; notifyEmail?: string }): Promise<FormDef | { error: string }> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  const slug = slugify(input.slug || name);
  if (!name || !slug) return { error: "Name required" };
  const fields = normalizeFields(input.fields);
  if (fields.length === 0) return { error: "Add at least one field" };
  const forms = await getForms();
  if (forms.some((f) => f.slug === slug)) return { error: "A form with that slug already exists" };
  const form: FormDef = {
    id: uid(), slug, name, fields,
    submitLabel: String(input.submitLabel ?? "Submit").slice(0, 40) || "Submit",
    successMessage: String(input.successMessage ?? "Thanks — we'll be in touch.").slice(0, 200),
    createdAt: new Date().toISOString(),
  };
  if (typeof input.notifyEmail === "string" && EMAIL_RE.test(input.notifyEmail.trim())) form.notifyEmail = input.notifyEmail.trim().slice(0, 120);
  forms.push(form);
  await writeJsonDoc(FORMS_KEY, forms);
  return form;
}
export async function updateForm(slug: string, patch: Partial<Pick<FormDef, "name" | "submitLabel" | "successMessage" | "notifyEmail">> & { fields?: FormField[] }): Promise<FormDef | null> {
  const forms = await getForms();
  const f = forms.find((x) => x.slug === slug);
  if (!f) return null;
  if (patch.name) f.name = String(patch.name).slice(0, 80);
  if (patch.submitLabel) f.submitLabel = String(patch.submitLabel).slice(0, 40);
  if (patch.successMessage !== undefined) f.successMessage = String(patch.successMessage).slice(0, 200);
  if (patch.fields) f.fields = normalizeFields(patch.fields);
  if (patch.notifyEmail !== undefined) {
    const v = String(patch.notifyEmail).trim();
    f.notifyEmail = EMAIL_RE.test(v) ? v.slice(0, 120) : undefined; // empty/invalid clears
  }
  await writeJsonDoc(FORMS_KEY, forms);
  return f;
}
export async function deleteForm(slug: string): Promise<boolean> {
  const forms = await getForms();
  const next = forms.filter((f) => f.slug !== slug);
  if (next.length === forms.length) return false;
  await writeJsonDoc(FORMS_KEY, next);
  await writeJsonDoc(subsKey(slug), []);
  // Clear any not-yet-compacted submission items too.
  const { listJsonDocs, deleteJsonDoc } = await import("./storage");
  await Promise.all((await listJsonDocs(subItemPrefix(slug))).map((k) => deleteJsonDoc(k)));
  return true;
}

// ─── Submissions (race-safe append-log; see lib/append-log.ts) ──────
const subItemPrefix = (slug: string) => `form-sub-${slug}-item-`;

export async function getSubmissions(slug: string): Promise<Submission[]> {
  const subs = await readWithCompaction<Submission>(subsKey(slug), subItemPrefix(slug));
  return [...subs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function addSubmission(slug: string, data: Record<string, unknown>, spam = false): Promise<Submission> {
  const sub: Submission = { id: uid(), data, createdAt: new Date().toISOString(), ...(spam ? { spam: true } : {}) };
  // Atomic per-submission write — concurrent submits can never lose one.
  await appendLogItem(subItemPrefix(slug), sub.id, sub);
  return sub;
}
export async function deleteSubmission(slug: string, id: string): Promise<boolean> {
  const subs = await readWithCompaction<Submission>(subsKey(slug), subItemPrefix(slug));
  const next = subs.filter((s) => s.id !== id);
  if (next.length === subs.length) return false;
  await writeJsonDoc(subsKey(slug), next);
  return true;
}

/** Validate + coerce a raw public submission against the form's field schema. */
export function validateSubmission(form: FormDef, raw: Record<string, unknown>): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const data: Record<string, unknown> = {};
  for (const f of form.fields) {
    const v = raw[f.key];
    if (f.required && (v === undefined || v === null || String(v).trim() === "" || (f.type === "checkbox" && !v))) {
      return { ok: false, error: `${f.label} is required` };
    }
    if (v === undefined) continue;
    if (f.type === "number") {
      const n = Number(v);
      if (String(v).trim() !== "" && !Number.isFinite(n)) return { ok: false, error: `${f.label} must be a number` };
      if (f.min !== undefined && n < f.min) return { ok: false, error: `${f.label} must be at least ${f.min}` };
      if (f.max !== undefined && n > f.max) return { ok: false, error: `${f.label} must be at most ${f.max}` };
      data[f.key] = n;
    } else if (f.type === "checkbox") {
      data[f.key] = !!v;
    } else {
      const s = String(v).slice(0, 5000);
      if (s.trim() !== "") {
        if (f.type === "email" && !EMAIL_RE.test(s.trim())) return { ok: false, error: `${f.label} must be a valid email` };
        if (f.min !== undefined && s.length < f.min) return { ok: false, error: `${f.label} must be at least ${f.min} characters` };
        if (f.max !== undefined && s.length > f.max) return { ok: false, error: `${f.label} must be at most ${f.max} characters` };
        if (f.pattern) {
          try {
            if (!new RegExp(f.pattern).test(s)) return { ok: false, error: `${f.label} has an invalid format` };
          } catch { /* invalid stored regex — skip rule */ }
        }
      }
      data[f.key] = s;
    }
  }
  return { ok: true, data };
}

/** Submissions as a CSV string (header row from the union of keys). */
export function submissionsToCsv(form: FormDef, subs: Submission[]): string {
  const keys = form.fields.map((f) => f.key);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["submitted_at", ...keys].map(esc).join(",");
  const rows = subs.map((s) => [s.createdAt, ...keys.map((k) => s.data[k])].map(esc).join(","));
  return [header, ...rows].join("\n");
}
