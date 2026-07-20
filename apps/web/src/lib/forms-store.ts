import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
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
}

export interface FormDef {
  id: string;
  slug: string;
  name: string;
  fields: FormField[];
  submitLabel: string;
  successMessage: string;
  createdAt: string;
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
export async function createForm(input: { name: string; slug?: string; fields: FormField[]; submitLabel?: string; successMessage?: string }): Promise<FormDef | { error: string }> {
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
  forms.push(form);
  await writeJsonDoc(FORMS_KEY, forms);
  return form;
}
export async function updateForm(slug: string, patch: Partial<Pick<FormDef, "name" | "submitLabel" | "successMessage">> & { fields?: FormField[] }): Promise<FormDef | null> {
  const forms = await getForms();
  const f = forms.find((x) => x.slug === slug);
  if (!f) return null;
  if (patch.name) f.name = String(patch.name).slice(0, 80);
  if (patch.submitLabel) f.submitLabel = String(patch.submitLabel).slice(0, 40);
  if (patch.successMessage !== undefined) f.successMessage = String(patch.successMessage).slice(0, 200);
  if (patch.fields) f.fields = normalizeFields(patch.fields);
  await writeJsonDoc(FORMS_KEY, forms);
  return f;
}
export async function deleteForm(slug: string): Promise<boolean> {
  const forms = await getForms();
  const next = forms.filter((f) => f.slug !== slug);
  if (next.length === forms.length) return false;
  await writeJsonDoc(FORMS_KEY, next);
  await writeJsonDoc(subsKey(slug), []);
  return true;
}

// ─── Submissions ────────────────────────────────────────
export async function getSubmissions(slug: string): Promise<Submission[]> {
  return (await readJsonDoc<Submission[]>(subsKey(slug), [])).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function addSubmission(slug: string, data: Record<string, unknown>, spam = false): Promise<Submission> {
  const subs = await readJsonDoc<Submission[]>(subsKey(slug), []);
  const sub: Submission = { id: uid(), data, createdAt: new Date().toISOString(), ...(spam ? { spam: true } : {}) };
  subs.push(sub);
  await writeJsonDoc(subsKey(slug), subs.slice(-5000));
  return sub;
}
export async function deleteSubmission(slug: string, id: string): Promise<boolean> {
  const subs = await readJsonDoc<Submission[]>(subsKey(slug), []);
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
    if (f.type === "number") data[f.key] = Number(v);
    else if (f.type === "checkbox") data[f.key] = !!v;
    else data[f.key] = String(v).slice(0, 5000);
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
