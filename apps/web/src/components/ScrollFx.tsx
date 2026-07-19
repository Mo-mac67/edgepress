"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Progressive scroll-reveal: sections fade/rise in as they enter the viewport.
 * - Only activates once JS runs (html.fx), so no-JS and crawlers see everything.
 * - Skips the first section (hero) to protect LCP.
 * - Respects prefers-reduced-motion.
 * - Disabled inside the admin.
 */
export function ScrollFx() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.includes("/admin")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.classList.add("fx");
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section, main section"))
      .filter((el, i) => i > 0 && !el.closest("iframe"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("fx-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    for (const el of sections) {
      // Anything already on screen shows immediately (no pop-in on load).
      const r = el.getBoundingClientRect();
      if (window.innerHeight === 0 || r.top < window.innerHeight * 0.92) el.classList.add("fx-in");
      else io.observe(el);
    }
    // Safety net: if the observer never fired at all (broken environment),
    // reveal everything rather than leave content hidden. A working observer
    // will have revealed at least the near-viewport sections by then.
    const failsafe = window.setTimeout(() => {
      if (sections.some((el) => !el.classList.contains("fx-in")) && document.querySelector("main section.fx-in") === null) {
        for (const el of sections) el.classList.add("fx-in");
      }
    }, 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
      document.documentElement.classList.remove("fx");
    };
  }, [pathname]);

  return null;
}
