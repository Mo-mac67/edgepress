"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SocialLinks } from "./SocialLinks";
import type { SiteSettings } from "@/lib/cms-types";
import type { Locale } from "@/i18n/config";

/**
 * The site's only navigation: a "Menu" button whose links drop straight down
 * underneath the word itself — right-aligned, NO background panel, transparent
 * over the page. Links reveal with the hero's translate-and-fade transform
 * (cubic-bezier(0.16,1,0.3,1)), staggered. Text colour follows the header
 * (white over the photo, ink once solid). Closes on link click, Escape,
 * outside click, or scroll.
 */
export function MobileMenu({
  links,
  settings,
  light = false,
}: {
  links: { href: string; label: string }[];
  ctaHref?: string;
  ctaLabel?: string;
  settings: SiteSettings;
  locale?: Locale;
  light?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  const tel = settings.phone.replace(/[^\d+]/g, "");
  const ease = "ease-[cubic-bezier(0.16,1,0.3,1)]";
  const onDark = light; // white over the photo, ink once the header is solid
  const linkColor = onDark
    ? "text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.55)] hover:text-accent"
    : "text-brand hover:text-accent-dark";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`group relative z-[110] inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition ${
          open || light ? "text-white" : "text-brand"
        }`}
      >
        <span className="flex flex-col items-end gap-[4px]">
          <span className={`block h-[1.5px] bg-current transition-all duration-300 ${open ? "w-5 translate-y-[5.5px] rotate-45" : "w-5 group-hover:w-3.5"}`} />
          <span className={`block h-[1.5px] w-3.5 bg-current transition-all duration-300 ${open ? "-translate-y-[5.5px] w-5 -rotate-45" : "group-hover:w-5"}`} />
        </span>
        <span className="hidden sm:inline">{open ? "Close" : "Menu"}</span>
      </button>

      {/* Links drop straight down under the word — right-aligned, no background */}
      <div
        className={`absolute right-0 top-full z-50 mt-3 flex flex-col items-end gap-0.5 text-right transition-all duration-500 ${ease} ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        {links.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            style={{ transitionDelay: open ? `${70 + i * 50}ms` : "0ms" }}
            className={`whitespace-nowrap py-0.5 font-display text-xl font-light italic leading-tight tracking-tight transition-all duration-[600ms] ${ease} sm:text-2xl ${
              open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            } ${linkColor}`}
          >
            {l.label}
          </Link>
        ))}

        <div
          style={{ transitionDelay: open ? `${70 + links.length * 50}ms` : "0ms" }}
          className={`mt-3 flex flex-col items-end gap-1 text-xs font-medium transition-all duration-[600ms] ${ease} ${
            open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          } ${onDark ? "text-white/75 [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]" : "text-ink-soft"}`}
        >
          <a href={`tel:${tel}`} className="hover:text-accent">{settings.phone}</a>
          <a href={`mailto:${settings.email}`} className="hover:text-accent">{settings.email}</a>
        </div>

        <SocialLinks
          settings={settings}
          size={18}
          className={`mt-2.5 justify-end ${onDark ? "text-white" : "text-brand"}`}
        />
      </div>
    </div>
  );
}
