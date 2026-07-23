"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { MediaField } from "./MediaField";
import { useAdminUI } from "./ui";

interface Localized { en: string; fr: string; [k: string]: string }
interface Lesson { id: string; slug: string; title: Localized; videoUrl?: string; body: Localized }
interface Course { id: string; slug: string; title: Localized; description: Localized; cover?: string; status: "draft" | "published"; lessons: Lesson[]; updatedAt: string }

const L = (en = "", fr = ""): Localized => ({ en, fr });

export function CoursesPanel() {
  const ui = useAdminUI();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loc, setLoc] = useState<"en" | "fr">("en");
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/courses");
    if (res.ok) setCourses((await res.json()).courses ?? []);
  }
  useEffect(() => { load(); }, []);

  const course = courses.find((c) => c.id === activeId) ?? null;
  const patch = (p: Partial<Course>) => setCourses(courses.map((c) => (c.id === activeId ? { ...c, ...p } : c)));

  async function create() {
    const title = await ui.prompt({ title: "New course", label: "Course title", confirmLabel: "Create", validate: (v) => (v.trim() ? null : "Enter a title") });
    if (!title) return;
    const res = await fetch("/api/admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: { en: title, fr: "" } }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { await load(); setActiveId(d.course.id); }
    else ui.toast(d.error || "Couldn't create", "error");
  }

  async function save() {
    if (!course) return;
    const res = await fetch(`/api/admin/courses/${course.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(course) });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); load(); }
    else ui.toast("Couldn't save", "error");
  }

  async function remove(id: string) {
    if (!(await ui.confirm({ title: "Delete this course?", message: "All its lessons go too.", danger: true, confirmLabel: "Delete" }))) return;
    await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
    setActiveId(null);
    load();
  }

  const setLesson = (i: number, p: Partial<Lesson>) => patch({ lessons: course!.lessons.map((l, k) => (k === i ? { ...l, ...p } : l)) });
  const moveLesson = (i: number, dir: -1 | 1) => {
    const ls = [...course!.lessons];
    const j = i + dir;
    if (j < 0 || j >= ls.length) return;
    [ls[i], ls[j]] = [ls[j], ls[i]];
    patch({ lessons: ls });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {courses.map((c) => (
          <button key={c.id} onClick={() => setActiveId(c.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeId === c.id ? "bg-brand text-white" : "bg-surface-soft text-ink-soft hover:text-ink"}`}>
            {c.title.en || c.title.fr || c.slug}{c.status === "draft" && <span className="ml-1.5 text-xs opacity-70">(draft)</span>}
          </button>
        ))}
        <button onClick={create} className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-brand hover:bg-surface-soft">+ New course</button>
      </div>

      {!course && courses.length === 0 && (
        <div className="card p-8 text-center">
          <h3 className="font-display font-semibold text-brand">No courses yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Build video + text lessons served at <code className="rounded bg-surface-soft px-1">/learn</code>. Visitors track their own progress — no accounts needed.</p>
          <button onClick={create} className="btn-primary mt-4">Create your first course</button>
        </div>
      )}

      {course && (
        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-soft">Public at <code className="rounded bg-surface-soft px-1">/en/learn/{course.slug}</code></p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-line p-0.5 text-sm">
                {(["en", "fr"] as const).map((l) => (
                  <button key={l} onClick={() => setLoc(l)} className={`rounded-full px-3 py-1 ${loc === l ? "bg-accent-soft font-semibold text-accent-dark" : "text-ink-soft"}`}>{l.toUpperCase()}</button>
                ))}
              </div>
              <select className="field w-auto" value={course.status} onChange={(e) => patch({ status: e.target.value as Course["status"] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <button onClick={save} className="btn-primary py-2 text-sm">{saved ? "Saved ✓" : "Save"}</button>
              <button onClick={() => remove(course.id)} className="rounded p-2 text-ink-soft hover:text-red-600" title="Delete course"><Icon name="trash" size={16} /></button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Title ({loc.toUpperCase()})</span>
              <input className="field" value={course.title[loc] ?? ""} onChange={(e) => patch({ title: { ...course.title, [loc]: e.target.value } })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Slug</span>
              <input className="field" value={course.slug} onChange={(e) => patch({ slug: e.target.value })} /></label>
          </div>
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Description ({loc.toUpperCase()})</span>
            <textarea className="field min-h-[70px]" value={course.description[loc] ?? ""} onChange={(e) => patch({ description: { ...course.description, [loc]: e.target.value } })} /></label>
          <div><span className="mb-1 block text-sm font-medium text-ink">Cover image</span><MediaField value={course.cover ?? ""} onChange={(v) => patch({ cover: v })} /></div>

          <p className="mt-2 text-sm font-semibold text-ink">Lessons</p>
          <div className="space-y-3">
            {course.lessons.map((l, i) => (
              <div key={l.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                  <input className="field" placeholder={`Lesson title (${loc.toUpperCase()})`} value={l.title[loc] ?? ""} onChange={(e) => setLesson(i, { title: { ...l.title, [loc]: e.target.value } })} />
                  <button onClick={() => moveLesson(i, -1)} className="rounded p-1.5 hover:bg-sand"><Icon name="arrow-left" size={14} className="rotate-90" /></button>
                  <button onClick={() => moveLesson(i, 1)} className="rounded p-1.5 hover:bg-sand"><Icon name="arrow-right" size={14} className="rotate-90" /></button>
                  <button onClick={() => patch({ lessons: course.lessons.filter((_, k) => k !== i) })} className="rounded p-1.5 text-red-600 hover:bg-sand"><Icon name="trash" size={14} /></button>
                </div>
                <input className="field mt-2" placeholder="Video URL (YouTube/Vimeo, optional)" value={l.videoUrl ?? ""} onChange={(e) => setLesson(i, { videoUrl: e.target.value })} />
                <textarea className="field mt-2 min-h-[90px] font-mono text-xs" placeholder={`Lesson body HTML (${loc.toUpperCase()})`} value={l.body[loc] ?? ""} onChange={(e) => setLesson(i, { body: { ...l.body, [loc]: e.target.value } })} />
              </div>
            ))}
          </div>
          <button onClick={() => patch({ lessons: [...course.lessons, { id: Math.random().toString(36).slice(2, 10), slug: "", title: L(), body: L() }] })} className="text-sm font-semibold text-brand">+ Add lesson</button>
        </div>
      )}
    </div>
  );
}
