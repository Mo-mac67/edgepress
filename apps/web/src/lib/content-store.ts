import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Custom Content Types ("Collections") — the headless-CMS core. The owner
 * defines arbitrary content types with typed fields; entries are then created,
 * published and served through the public Content API (see api/content).
 */

export type FieldType = "text" | "textarea" | "richtext" | "number" | "boolean" | "date" | "image" | "select";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for "select"
}

export interface ContentType {
  id: string;
  slug: string; // url-safe, plural, e.g. "products"
  name: string; // human label, e.g. "Products"
  icon?: string;
  fields: Field[];
  createdAt: string;
}

export interface Entry {
  id: string;
  type: string; // ContentType.slug
  slug: string;
  status: "draft" | "published";
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TYPES_KEY = "content-types.json";
const entriesKey = (typeSlug: string) => `content-entries-${typeSlug}.json`;
const uid = () => randomUUID().slice(0, 8);

export function slugify(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// ─── Content types ──────────────────────────────────────
export async function getContentTypes(): Promise<ContentType[]> {
  return readJsonDoc<ContentType[]>(TYPES_KEY, []);
}
export async function getContentType(slug: string): Promise<ContentType | null> {
  return (await getContentTypes()).find((t) => t.slug === slug) ?? null;
}
export async function saveContentType(input: { name: string; slug?: string; icon?: string; fields: Field[] }): Promise<ContentType | { error: string }> {
  const name = String(input.name ?? "").trim().slice(0, 60);
  const slug = slugify(input.slug || name);
  if (!name || !slug) return { error: "Name required" };
  const fields = normalizeFields(input.fields);
  if (fields.length === 0) return { error: "At least one field required" };
  const types = await getContentTypes();
  if (types.some((t) => t.slug === slug)) return { error: "A type with that slug already exists" };
  const type: ContentType = { id: uid(), slug, name, icon: input.icon, fields, createdAt: new Date().toISOString() };
  types.push(type);
  await writeJsonDoc(TYPES_KEY, types);
  return type;
}
export async function updateContentType(slug: string, patch: { name?: string; icon?: string; fields?: Field[] }): Promise<ContentType | null> {
  const types = await getContentTypes();
  const t = types.find((x) => x.slug === slug);
  if (!t) return null;
  if (patch.name) t.name = String(patch.name).trim().slice(0, 60);
  if (patch.icon !== undefined) t.icon = patch.icon;
  if (patch.fields) t.fields = normalizeFields(patch.fields);
  await writeJsonDoc(TYPES_KEY, types);
  return t;
}
export async function deleteContentType(slug: string): Promise<boolean> {
  const types = await getContentTypes();
  const next = types.filter((t) => t.slug !== slug);
  if (next.length === types.length) return false;
  await writeJsonDoc(TYPES_KEY, next);
  await writeJsonDoc(entriesKey(slug), []); // drop entries too
  return true;
}

function normalizeFields(raw: unknown): Field[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Field[] = [];
  for (const f of raw) {
    const key = slugify(String((f as Field)?.key || (f as Field)?.label || "")).replace(/-/g, "_");
    const label = String((f as Field)?.label || key).slice(0, 60);
    const type = (["text", "textarea", "richtext", "number", "boolean", "date", "image", "select"] as FieldType[]).includes((f as Field)?.type) ? (f as Field).type : "text";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const field: Field = { key, label, type };
    if ((f as Field)?.required) field.required = true;
    if (type === "select" && Array.isArray((f as Field).options)) field.options = (f as Field).options!.map((o) => String(o)).filter(Boolean).slice(0, 40);
    out.push(field);
  }
  return out.slice(0, 40);
}

// ─── Entries ────────────────────────────────────────────
export async function getEntries(typeSlug: string): Promise<Entry[]> {
  const entries = await readJsonDoc<Entry[]>(entriesKey(typeSlug), []);
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getPublishedEntries(typeSlug: string): Promise<Entry[]> {
  return (await getEntries(typeSlug)).filter((e) => e.status === "published");
}
export async function getEntry(typeSlug: string, idOrSlug: string): Promise<Entry | null> {
  const entries = await getEntries(typeSlug);
  return entries.find((e) => e.id === idOrSlug || e.slug === idOrSlug) ?? null;
}
export async function createEntry(typeSlug: string, input: { slug?: string; status?: string; data?: Record<string, unknown> }): Promise<Entry | { error: string }> {
  const type = await getContentType(typeSlug);
  if (!type) return { error: "Unknown content type" };
  const entries = await readJsonDoc<Entry[]>(entriesKey(typeSlug), []);
  const base = input.slug || (input.data?.[type.fields[0]?.key] as string) || "entry";
  let slug = slugify(String(base)) || "entry";
  if (entries.some((e) => e.slug === slug)) slug = `${slug}-${uid()}`;
  const now = new Date().toISOString();
  const entry: Entry = {
    id: uid(),
    type: typeSlug,
    slug,
    status: input.status === "published" ? "published" : "draft",
    data: input.data ?? {},
    createdAt: now,
    updatedAt: now,
  };
  entries.push(entry);
  await writeJsonDoc(entriesKey(typeSlug), entries);
  return entry;
}
export async function updateEntry(typeSlug: string, id: string, patch: { slug?: string; status?: string; data?: Record<string, unknown> }): Promise<Entry | null> {
  const entries = await readJsonDoc<Entry[]>(entriesKey(typeSlug), []);
  const e = entries.find((x) => x.id === id);
  if (!e) return null;
  if (patch.slug) e.slug = slugify(patch.slug) || e.slug;
  if (patch.status) e.status = patch.status === "published" ? "published" : "draft";
  if (patch.data) e.data = patch.data;
  e.updatedAt = new Date().toISOString();
  await writeJsonDoc(entriesKey(typeSlug), entries);
  return e;
}
export async function deleteEntry(typeSlug: string, id: string): Promise<boolean> {
  const entries = await readJsonDoc<Entry[]>(entriesKey(typeSlug), []);
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return false;
  await writeJsonDoc(entriesKey(typeSlug), next);
  return true;
}
