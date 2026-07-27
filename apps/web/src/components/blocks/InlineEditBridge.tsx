"use client";

import { useEffect } from "react";

/**
 * Mounted inside the public page ONLY in inline-edit mode (?epedit=1 + an
 * authenticated admin). It turns every element the block renderer tagged with
 * `data-ep-f` into a directly editable field: click the text on the page, type,
 * and on blur it postMessages the new value up to the editor (the parent
 * window), which patches the block and autosaves. Nothing here runs for normal
 * visitors — the page route only renders this component for a signed-in admin.
 */
export function InlineEditBridge({ locale }: { locale: string }) {
  useEffect(() => {
    const origin = window.location.origin;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-ep-f]"));

    const send = (el: HTMLElement) => {
      const rich = el.dataset.epRich === "1";
      window.parent.postMessage(
        {
          source: "edgepress",
          type: "ep-edit",
          blockId: el.dataset.epB,
          field: el.dataset.epF,
          locale,
          value: rich ? el.innerHTML : (el.innerText ?? "").replace(/ /g, " ").trim(),
        },
        origin,
      );
    };
    const onBlur = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el.dataset?.epF) send(el);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!el.dataset?.epF) return;
      // Enter commits single-line fields; rich fields keep multi-line behaviour.
      if (e.key === "Enter" && !e.shiftKey && el.dataset.epRich !== "1") {
        e.preventDefault();
        el.blur();
      }
      if (e.key === "Escape") el.blur();
    };

    for (const el of els) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "false");
      el.addEventListener("blur", onBlur, true);
      el.addEventListener("keydown", onKey);
    }

    // Editing affordance — dashed outline, brighter on hover/focus.
    const style = document.createElement("style");
    style.textContent =
      "[data-ep-f]{outline:1px dashed rgba(245,158,11,.55);outline-offset:3px;border-radius:3px;transition:background .12s}" +
      "[data-ep-f]:hover{outline-color:#f59e0b;background:rgba(245,158,11,.07);cursor:text}" +
      "[data-ep-f]:focus{outline:2px solid #f59e0b;background:rgba(245,158,11,.10)}";
    document.head.appendChild(style);

    // ---- structural controls: a floating toolbar per block (move / add / delete) ----
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-ep-block-id]"));
    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-ep-ui", "1");
    toolbar.style.cssText =
      "position:absolute;z-index:2147482000;display:none;gap:3px;background:#12171f;border:1px solid #2a333f;border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.5)";
    const btn = (op: string, glyph: string, title: string, color = "#eef2f6") =>
      `<button data-op="${op}" title="${title}" style="background:none;border:0;color:${color};cursor:pointer;font-size:14px;line-height:1;padding:4px 6px;border-radius:5px">${glyph}</button>`;
    toolbar.innerHTML = btn("up", "&#8593;", "Move up") + btn("down", "&#8595;", "Move down") + btn("add", "&#43;", "Add block below", "#7ff5c8") + btn("delete", "&#10005;", "Delete block", "#f87171");
    document.body.appendChild(toolbar);
    let curBlockId: string | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      toolbar.style.top = `${window.scrollY + r.top + 6}px`;
      toolbar.style.left = `${Math.max(8, window.scrollX + r.right - 132)}px`;
      toolbar.style.display = "flex";
    };
    const onEnter = (e: Event) => {
      clearTimeout(hideTimer);
      const el = e.currentTarget as HTMLElement;
      curBlockId = el.getAttribute("data-ep-block-id");
      place(el);
    };
    const scheduleHide = () => { hideTimer = setTimeout(() => (toolbar.style.display = "none"), 400); };
    for (const b of blocks) { b.addEventListener("mouseenter", onEnter); b.addEventListener("mouseleave", scheduleHide); }
    toolbar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    toolbar.addEventListener("mouseleave", scheduleHide);
    toolbar.addEventListener("click", (e) => {
      const op = (e.target as HTMLElement).getAttribute?.("data-op");
      if (op && curBlockId) window.parent.postMessage({ source: "edgepress", type: "ep-block-op", op, blockId: curBlockId }, origin);
    });
    const bstyle = document.createElement("style");
    bstyle.textContent = "[data-ep-block-id]{outline:1px dashed transparent;transition:outline-color .12s}[data-ep-block-id]:hover{outline-color:rgba(79,240,181,.4)}";
    document.head.appendChild(bstyle);

    window.parent.postMessage({ source: "edgepress", type: "ep-ready", count: els.length }, origin);

    return () => {
      for (const el of els) {
        el.removeAttribute("contenteditable");
        el.removeEventListener("blur", onBlur, true);
        el.removeEventListener("keydown", onKey);
      }
      for (const b of blocks) { b.removeEventListener("mouseenter", onEnter); b.removeEventListener("mouseleave", scheduleHide); }
      style.remove();
      bstyle.remove();
      toolbar.remove();
    };
  }, [locale]);

  return null;
}
