"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MediaLibrary } from "./MediaLibrary";
import { isVideoUrl } from "@/lib/cms-types";

export function MediaField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-sand">
          {value ? (
            isVideoUrl(value) ? (
              <video src={value} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="flex h-full items-center justify-center text-ink-soft"><Icon name="image" size={20} /></span>
          )}
        </div>
        <div className="flex-1">
          <input
            className="field text-xs"
            value={value}
            placeholder="Image URL or choose from library"
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-accent-dark hover:underline">
              Choose / upload
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")} className="text-xs text-ink-soft hover:text-red-600">
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-brand-dark/50" />
          <div className="relative z-10 max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand">Media library</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink"><Icon name="x" size={20} /></button>
            </div>
            <MediaLibrary
              onPick={(url) => {
                onChange(url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
