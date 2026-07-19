"use client";

import { useState } from "react";
import Image from "next/image";

export interface ProjectCard {
  id: string;
  title: string;
  location: string;
  desc: string;
  category: string;
  src: string;
  alt: string;
}

export function ProjectsGrid({
  projects,
  categories,
}: {
  projects: ProjectCard[];
  categories: { id: string; label: string }[];
}) {
  const [active, setActive] = useState("all");
  const shown = active === "all" ? projects : projects.filter((p) => p.category === active);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active === c.id
                ? "bg-brand text-white"
                : "border border-line bg-white text-ink-soft hover:border-brand hover:text-brand"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <article key={p.id} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(max-width:768px) 100vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">{p.location}</p>
              <h3 className="mt-1.5 font-display text-lg font-bold text-brand">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
