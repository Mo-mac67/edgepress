"use client";

import { useRef } from "react";

/**
 * Dependency-free code editor — a line-numbered, monospace textarea with tab
 * support and a scroll-synced gutter. Used for editing page HTML and custom
 * site code (the Blogger/WordPress "Edit HTML" experience) without pulling in a
 * heavy editor library.
 */
export function CodeEditor({
  value,
  onChange,
  minHeight = 420,
  placeholder,
  ariaLabel = "Code editor",
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);

  function syncScroll() {
    if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "  " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-line bg-[#0f1729] font-mono text-xs leading-[1.6]">
      <div
        ref={gutterRef}
        aria-hidden
        className="select-none overflow-hidden whitespace-pre px-2 py-3 text-right text-white/30"
        style={{ minWidth: 42, maxHeight: minHeight + 24 }}
      >
        {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={onKeyDown}
        spellCheck={false}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="flex-1 resize-y border-0 bg-transparent px-3 py-3 text-[#e6edf3] outline-none placeholder:text-white/25"
        style={{ minHeight, tabSize: 2 }}
      />
    </div>
  );
}
