"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Full-viewport, auto-crossfading slideshow — the minimal, editorial hero
 * (reference: a luxury build studio's near-empty homepage). Pure photography
 * with a quiet centered overlay; slides cross-fade every ~6s. Respects
 * prefers-reduced-motion (holds on the first slide, no auto-advance).
 */
export function Slideshow({
  images,
  overlay,
  priorityFirst = true,
}: {
  images: string[];
  overlay?: React.ReactNode;
  priorityFirst?: boolean;
}) {
  const slides = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setInterval(() => setActive((i) => (i + 1) % slides.length), 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [slides.length]);

  if (slides.length === 0) {
    return <div className="h-full w-full bg-brand-soft" />;
  }

  return (
    <>
      {slides.map((src, i) => (
        <div
          key={src + i}
          aria-hidden={i !== active}
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
          style={{ opacity: i === active ? 1 : 0 }}
        >
          <Image
            src={src}
            alt=""
            fill
            priority={priorityFirst && i === 0}
            sizes="100vw"
            className="kenburns object-cover"
          />
        </div>
      ))}

      {/* Legibility scrim + optional centered overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-dark/45 via-brand-dark/10 to-brand-dark/55" />
      {overlay}

      {slides.length > 1 && (
        <div className="absolute right-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={`w-[3px] rounded-full transition-all duration-300 ${
                i === active ? "h-8 bg-white" : "h-4 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
