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

    window.parent.postMessage({ source: "edgepress", type: "ep-ready", count: els.length }, origin);

    return () => {
      for (const el of els) {
        el.removeAttribute("contenteditable");
        el.removeEventListener("blur", onBlur, true);
        el.removeEventListener("keydown", onKey);
      }
      style.remove();
    };
  }, [locale]);

  return null;
}
