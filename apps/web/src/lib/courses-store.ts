import "server-only";
import { randomUUID } from "node:crypto";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { slugify } from "./content-store";
import type { Localized } from "./cms-types";

/**
 * LMS-lite: courses → ordered lessons (video + rich body), served at
 * /{lang}/learn. Owner-authored, low write volume → one document. Learner
 * progress is client-side (localStorage) in v1 — no accounts required.
 */

export interface Lesson {
  id: string;
  slug: string;
  title: Localized;
  /** YouTube/Vimeo/etc URL — rendered via the shared embed helper. */
  videoUrl?: string;
  /** Rich HTML body per locale. */
  body: Localized;
}

export interface Course {
  id: string;
  slug: string;
  title: Localized;
  description: Localized;
  cover?: string;
  status: "draft" | "published";
  lessons: Lesson[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "courses.json";
const MAX_COURSES = 100;
const MAX_LESSONS = 100;
const uid = () => randomUUID().slice(0, 8);

const asLocalized = (v: unknown): Localized => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, string>;
  return { en: String(o.en ?? "").slice(0, 20_000), fr: String(o.fr ?? "").slice(0, 20_000), ...Object.fromEntries(Object.entries(o).filter(([k]) => k !== "en" && k !== "fr").map(([k, s]) => [k, String(s).slice(0, 20_000)])) };
};

function normalizeLessons(raw: unknown): Lesson[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Lesson[] = [];
  for (const l of raw.slice(0, MAX_LESSONS)) {
    const item = l as Partial<Lesson>;
    let slug = slugify(String(item.slug || (item.title as Record<string, string>)?.en || (item.title as Record<string, string>)?.fr || "lesson"));
    if (!slug) slug = "lesson";
    while (seen.has(slug)) slug = `${slug}-${uid().slice(0, 4)}`;
    seen.add(slug);
    out.push({
      id: String(item.id ?? uid()).slice(0, 20),
      slug,
      title: asLocalized(item.title),
      ...(item.videoUrl ? { videoUrl: String(item.videoUrl).slice(0, 500) } : {}),
      body: asLocalized(item.body),
    });
  }
  return out;
}

export async function getCourses(): Promise<Course[]> {
  return readJsonDoc<Course[]>(KEY, []);
}
export async function getPublishedCourses(): Promise<Course[]> {
  return (await getCourses()).filter((c) => c.status === "published");
}
export async function getCourse(idOrSlug: string): Promise<Course | null> {
  return (await getCourses()).find((c) => c.id === idOrSlug || c.slug === idOrSlug) ?? null;
}

export async function createCourse(input: { title?: unknown; slug?: string }): Promise<Course | { error: string }> {
  const title = asLocalized(input.title);
  if (!title.en.trim() && !title.fr.trim()) return { error: "Give the course a title" };
  const courses = await getCourses();
  if (courses.length >= MAX_COURSES) return { error: `Limit of ${MAX_COURSES} courses reached` };
  let slug = slugify(input.slug || title.en || title.fr) || "course";
  while (courses.some((c) => c.slug === slug)) slug = `${slug}-${uid().slice(0, 4)}`;
  const now = new Date().toISOString();
  const course: Course = { id: uid(), slug, title, description: asLocalized({}), status: "draft", lessons: [], createdAt: now, updatedAt: now };
  courses.push(course);
  await writeJsonDoc(KEY, courses);
  return course;
}

export async function updateCourse(id: string, patch: Partial<Course>): Promise<Course | null> {
  const courses = await getCourses();
  const c = courses.find((x) => x.id === id);
  if (!c) return null;
  if (patch.title !== undefined) c.title = asLocalized(patch.title);
  if (patch.description !== undefined) c.description = asLocalized(patch.description);
  if (patch.cover !== undefined) c.cover = String(patch.cover).slice(0, 500) || undefined;
  if (patch.status) c.status = patch.status === "published" ? "published" : "draft";
  if (patch.slug) {
    const next = slugify(patch.slug);
    if (next && !courses.some((x) => x.id !== id && x.slug === next)) c.slug = next;
  }
  if (patch.lessons !== undefined) c.lessons = normalizeLessons(patch.lessons);
  c.updatedAt = new Date().toISOString();
  await writeJsonDoc(KEY, courses);
  return c;
}

export async function deleteCourse(id: string): Promise<boolean> {
  const courses = await getCourses();
  const next = courses.filter((c) => c.id !== id);
  if (next.length === courses.length) return false;
  await writeJsonDoc(KEY, next);
  return true;
}
