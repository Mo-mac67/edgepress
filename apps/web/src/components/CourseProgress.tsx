"use client";

import { useEffect, useState } from "react";

const key = (course: string) => `ep-progress-${course}`;

export function readProgress(course: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key(course)) ?? "[]");
  } catch {
    return [];
  }
}

/** Progress bar + per-lesson checkmarks (localStorage — no account needed). */
export function CourseProgress({ course, lessonSlugs, labels }: { course: string; lessonSlugs: string[]; labels: { complete: string } }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { setDone(readProgress(course)); }, [course]);
  const pct = lessonSlugs.length ? Math.round((lessonSlugs.filter((s) => done.includes(s)).length / lessonSlugs.length) * 100) : 0;
  if (pct === 0) return null;
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink-soft">{pct}% {labels.complete}</p>
    </div>
  );
}

export function LessonCheck({ course, lesson }: { course: string; lesson: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { setDone(readProgress(course).includes(lesson)); }, [course, lesson]);
  if (!done) return null;
  return <span aria-label="completed" className="ml-2 font-bold text-accent-dark">✓</span>;
}

/** "Mark complete" toggle on a lesson page. */
export function MarkComplete({ course, lesson, labels }: { course: string; lesson: string; labels: { done: string; mark: string } }) {
  const [done, setDone] = useState(false);
  useEffect(() => { setDone(readProgress(course).includes(lesson)); }, [course, lesson]);
  function toggle() {
    const cur = readProgress(course);
    const next = done ? cur.filter((s) => s !== lesson) : [...new Set([...cur, lesson])];
    localStorage.setItem(key(course), JSON.stringify(next));
    setDone(!done);
  }
  return (
    <button onClick={toggle} className={done ? "btn-secondary" : "btn-primary"}>
      {done ? `✓ ${labels.done}` : labels.mark}
    </button>
  );
}
