"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Dependency-free code editor — a line-numbered, monospace textarea with tab
 * support, Undo/Redo, and a real Find & Replace with VISIBLE highlighting.
 *
 * Highlighting a plain <textarea> is impossible (you can't paint inside it), so
 * we mirror the text in a backdrop <div> that sits exactly behind a transparent
 * textarea and draws <mark> rectangles under each match. The textarea (real
 * text + caret) renders on top, scroll-synced to the backdrop, so matches stay
 * lit even after focus leaves — and Replace / Replace all let you change a word
 * (e.g. "Toronto") everywhere in one action.
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
  const backdropRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);

  // Undo/redo history — coalesced into ~500ms bursts so undo isn't char-by-char.
  const hist = useRef<{ stack: string[]; ptr: number; last: number }>({ stack: [value], ptr: 0, last: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [query, setQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [active, setActive] = useState(0); // ordinal into `matches`

  // All match start-offsets (case-insensitive), recomputed when text/query change.
  const matches = useMemo(() => {
    if (!query) return [] as number[];
    const out: number[] = [];
    const hay = value.toLowerCase();
    const needle = query.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push(i);
      i = hay.indexOf(needle, i + needle.length);
    }
    return out;
  }, [value, query]);
  const activeIdx = matches.length ? Math.min(active, matches.length - 1) : 0;

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

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (gutterRef.current && ta) gutterRef.current.scrollTop = ta.scrollTop;
    if (backdropRef.current && ta) {
      backdropRef.current.scrollTop = ta.scrollTop;
      backdropRef.current.scrollLeft = ta.scrollLeft;
    }
  }, []);

  /** Reveal + select a match so the caret lands on it and it scrolls into view. */
  const gotoMatch = useCallback((k: number) => {
    const el = taRef.current;
    if (!el || !matches.length) return;
    const idx = ((k % matches.length) + matches.length) % matches.length;
    setActive(idx);
    const start = matches[idx];
    el.focus();
    el.setSelectionRange(start, start + query.length);
    const line = value.slice(0, start).split("\n").length - 1;
    el.scrollTop = Math.max(0, line * 19 - minHeight / 2);
    requestAnimationFrame(syncScroll);
  }, [matches, query, value, minHeight, syncScroll]);

  const replaceCurrent = useCallback(() => {
    if (!matches.length) return;
    const start = matches[activeIdx];
    commit(value.slice(0, start) + replaceWith + value.slice(start + query.length));
    setActive(activeIdx); // same ordinal → lands on the following match after re-render
    requestAnimationFrame(() => gotoMatch(activeIdx));
  }, [matches, activeIdx, value, replaceWith, query, commit, gotoMatch]);

  const replaceAll = useCallback(() => {
    if (!query || !matches.length) return;
    // Rebuild left-to-right so replacement text is never itself re-matched.
    let out = "";
    let last = 0;
    for (const start of matches) {
      out += value.slice(last, start) + replaceWith;
      last = start + query.length;
    }
    out += value.slice(last);
    commit(out);
  }, [query, matches, value, replaceWith, commit]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); setFindOpen(true); requestAnimationFrame(() => findRef.current?.focus()); return; }
    if (mod && e.key.toLowerCase() === "h") { e.preventDefault(); setFindOpen(true); setShowReplace(true); requestAnimationFrame(() => findRef.current?.focus()); return; }
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

  // Backdrop HTML: the text with a <mark> under each match (active one brighter).
  const highlightHtml = useMemo(() => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (!matches.length) return esc(value) + "\n";
    let html = "";
    let last = 0;
    matches.forEach((start, k) => {
      html += esc(value.slice(last, start));
      const bg = k === activeIdx ? "#f59e0b" : "rgba(245,158,11,.35)";
      html += `<mark style="background:${bg};color:transparent;border-radius:2px">${esc(value.slice(start, start + query.length))}</mark>`;
      last = start + query.length;
    });
    html += esc(value.slice(last)) + "\n";
    return html;
  }, [value, matches, activeIdx, query]);

  // Identical box model on backdrop + textarea so the highlights line up exactly.
  const textStyle: React.CSSProperties = { minHeight, tabSize: 2, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#0f1729]">
      {/* toolbar: undo/redo + find/replace */}
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-2 py-1.5 text-xs">
        <button type="button" onClick={undo} title="Undo (Ctrl+Z)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">↺ Undo</button>
        <button type="button" onClick={redo} title="Redo (Ctrl+Shift+Z)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">↻ Redo</button>
        <button type="button" onClick={() => { setFindOpen((o) => !o); requestAnimationFrame(() => findRef.current?.focus()); }} title="Find (Ctrl+F)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">🔍 Find</button>
        <button type="button" onClick={() => { setFindOpen(true); setShowReplace((o) => !o); requestAnimationFrame(() => findRef.current?.focus()); }} title="Replace (Ctrl+H)" className="rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">⇄ Replace</button>
        {findOpen && (
          <div className="ml-1 flex flex-wrap items-center gap-1">
            <input
              ref={findRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => { if (e.key === "Enter") gotoMatch(activeIdx + (e.shiftKey ? -1 : 1)); if (e.key === "Escape") setFindOpen(false); }}
              placeholder="Find…"
              className="w-40 rounded border border-white/15 bg-white/5 px-2 py-1 text-white placeholder:text-white/30 outline-none focus:border-white/40"
            />
            <span className="min-w-[46px] tabular-nums text-white/40">{query ? `${matches.length ? activeIdx + 1 : 0}/${matches.length}` : ""}</span>
            <button type="button" onClick={() => gotoMatch(activeIdx - 1)} className="rounded px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white" title="Previous (Shift+Enter)">↑</button>
            <button type="button" onClick={() => gotoMatch(activeIdx + 1)} className="rounded px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white" title="Next (Enter)">↓</button>
            {showReplace && (
              <>
                <input
                  value={replaceWith}
                  onChange={(e) => setReplaceWith(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") replaceCurrent(); if (e.key === "Escape") setFindOpen(false); }}
                  placeholder="Replace with…"
                  className="w-40 rounded border border-white/15 bg-white/5 px-2 py-1 text-white placeholder:text-white/30 outline-none focus:border-white/40"
                />
                <button type="button" onClick={replaceCurrent} disabled={!matches.length} className="rounded px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40" title="Replace this one">Replace</button>
                <button type="button" onClick={replaceAll} disabled={!matches.length} className="rounded bg-white/10 px-2 py-1 font-medium text-white hover:bg-white/20 disabled:opacity-40" title="Replace every match">All</button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex font-mono text-xs leading-[1.6]">
        <div ref={gutterRef} aria-hidden className="select-none overflow-hidden whitespace-pre px-2 py-3 text-right text-white/30" style={{ minWidth: 42, maxHeight: minHeight + 24 }}>
          {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
        </div>
        {/* sizing wrapper: backdrop (highlights) behind a transparent-bg textarea */}
        <div className="relative flex-1">
          <div
            ref={backdropRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-3 text-transparent"
            style={textStyle}
            dangerouslySetInnerHTML={{ __html: highlightHtml }}
          />
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => commit(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="relative block w-full resize-y border-0 bg-transparent px-3 py-3 text-[#e6edf3] caret-white outline-none placeholder:text-white/25"
            style={textStyle}
          />
        </div>
      </div>
    </div>
  );
}
