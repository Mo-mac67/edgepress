"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Interactive before/after comparison. The after image is revealed by dragging
 * the gold handle (pointer + touch + keyboard). Falls back gracefully: with no
 * JS the after image sits at 50%.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // % revealed of the AFTER image
  const [dragging, setDragging] = useState(false);

  const move = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const pct = ((clientX - r.left) / r.width) * 100;
    if (Number.isNaN(pct)) return;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* invalid pointer id (synthetic events) — dragging still works */
    }
    setDragging(true);
    move(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging) move(e.clientX);
  };
  const stop = () => setDragging(false);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
    if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
  };

  return (
    <div
      ref={ref}
      className="relative min-h-[380px] w-full touch-none select-none overflow-hidden md:min-h-[560px]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      role="slider"
      aria-label={`${beforeLabel} / ${afterLabel}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Before (base layer) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <span className="absolute left-6 top-6 z-10 bg-brand-dark/85 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
        {beforeLabel}
      </span>

      {/* After (revealed layer, clipped from the left) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <span className="absolute left-6 top-6 bg-accent px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">
          {afterLabel}
        </span>
      </div>

      {/* Divider + handle */}
      <div className="absolute inset-y-0 z-20" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-accent shadow-[0_0_14px_rgba(201,148,46,0.55)]" />
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          className={`absolute top-1/2 -ml-[31px] -mt-[31px] grid h-[62px] w-[62px] cursor-ew-resize place-items-center rounded-full bg-accent text-2xl font-bold text-white shadow-[0_10px_30px_rgba(15,20,25,0.35)] transition-transform duration-200 ${
            dragging ? "scale-110" : "hover:scale-105"
          }`}
        >
          ‹›
        </button>
      </div>
    </div>
  );
}
