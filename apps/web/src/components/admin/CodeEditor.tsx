"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Dependency-free code editor — a line-numbered, monospace textarea with tab
 * support, a scroll-synced gutter, in-editor Find (Ctrl+F), and Undo/Redo.
 * Used for editing page HTML and custom site code (the "Edit HTML" experience)
 * without pulling in a heavy editor library.
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
  const findRef = useRef<HTMLInputElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);

  // Undo/redo history — coalesced into ~500ms bursts so undo isn't char-by-char.
  const hist = useRef<{ stack: string[]; ptr: number; last: number }>({ stack: [value], ptr: 0, last: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");

  const commit = useCallback((next: string) => {
    const h = hist.current;
    const now = Date.now();
    if (now - h.last < 500 && h.ptr === h.stack.length - 1) {
      h.stack[h.ptr] = next; // coalesce rapid edits into one undo step
    } else {
      h.stack = h.stack.slice(0, h.ptr + 1);
      h.stack.push(next);
      h.ptr = h.stack.length - 1;
      if (h.stack.length > 200) { h.stack.shift(); h.ptr--; }
    }
    h.last = now;
    onChange(next);
  }, [onChange]);

  const undo = useCallback(() => {
    const h = hist.current;
    if (h.ptr > 0) { h.ptr--; onChange(h.stack[h.ptr]); }
  }, [onChange]);
  const redo = useCallback(() => {
    const h = hist.current;
    if (h.ptr < h.stack.length - 1) { h.ptr++; onChange(h.stack[h.ptr]); }
  }, [onChange]);

  function syncScroll() {
    if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop;
  }

  /** Select the next occurrence of the query after the caret (wraps around). */
  const findNext = useCallback((q: string, back = false) => {
    const el = taRef.current;
    if (!el || !q) return;
    const hay = value.toLowerCase();
    const needle = q.toLowerCase();
    let idx: number;
    if (back) {
      idx = hay.lastIndexOf(needle, Math.max(0, el.selectionStart - 1));
      if (idx < 0) idx = hay.lastIndexOf(needle);
    } else {
      idx = hay.indexOf(needle, el.selectionEnd);
      if (idx < 0) idx = hay.indexOf(needle); // wrap to top
    }
    if (idx < 0) return;
    el.focus();
    el.setSelectionRange(idx, idx + q.length);
    // scroll the match into view (approx by line)
    const line = value.slice(0, idx).split("\n").length - 1;
    el.scrollTop = Math.max(0, line * 19 - minHeight / 2);
    syncScroll();
  }, [value, minHeight]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); setFindOpen(true); requestAnimationFrame(() => findRef.current?.focus()); return; }
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      commit(value.slice(0, start) + "  " + value.slice(end));
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
    }
  }

  const matchCount = query ? value.toLowerCase().split(query.toLowerCase()).length - 1 : 0;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#0f1729]">
      {/* toolbar: undo/redo + find */}
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5 text-xs">
        <button type="button" onClick={undo} title="Undo (Ctrl+Z)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">↺ Undo</button>
        <button type="button" onClick={redo} title="Redo (Ctrl+Shift+Z)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">↻ Redo</button>
        <button type="button" onClick={() => { setFindOpen((o) => !o); requestAnimationFrame(() => findRef.current?.focus()); }} title="Find (Ctrl+F)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">🔍 Find</button>
        {findOpen && (
          <div className="ml-1 flex items-center gap-1">
            <input
              ref={findRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") findNext(query, e.shiftKey); if (e.key === "Escape") setFindOpen(false); }}
              placeholder="Find in code…"
              className="w-44 rounded border border-white/15 bg-white/5 px-2 py-1 text-white placeholder:text-white/30 outline-none focus:border-white/40"
            />
            <span className="tabular-nums text-white/40">{query ? `${matchCount}` : ""}</span>
            <button type="button" onClick={() => findNext(query)} className="rounded px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white" title="Next (Enter)">↓</button>
            <button type="button" onClick={() => findNext(query, true)} className="rounded px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white" title="Previous (Shift+Enter)">↑</button>
          </div>
        )}
      </div>
      <div className="flex font-mono text-xs leading-[1.6]">
        <div ref={gutterRef} aria-hidden className="select-none overflow-hidden whitespace-pre px-2 py-3 text-right text-white/30" style={{ minWidth: 42, maxHeight: minHeight + 24 }}>
          {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => commit(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="flex-1 resize-y border-0 bg-transparent px-3 py-3 text-[#e6edf3] outline-none placeholder:text-white/25"
          style={{ minHeight, tabSize: 2 }}
        />
      </div>
    </div>
  );
}
