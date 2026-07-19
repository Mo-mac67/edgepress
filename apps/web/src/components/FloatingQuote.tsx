"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * Mobile-only sticky action bar: Call + Get a Quote. Slides up after the
 * visitor scrolls past the hero, so it never covers the first impression.
 * Hidden on admin/account/tender screens and on the contact page itself
 * (the form is already there).
 */
export function FloatingQuote({ locale, phone, quoteLabel, callLabel }: { locale: string; phone: string; quoteLabel: string; callLabel: string }) {
  const pathname = usePathname() ?? "";
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (/\/(admin|account|tenders|contact)(\/|$)/.test(pathname)) return null;
  const tel = phone.replace(/[^\d+]/g, "");

  return (
    <div
      className={`no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <a
          href={`tel:${tel}`}
          className="flex flex-1 items-center justify-center gap-2 border border-brand py-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand"
        >
          <Icon name="phone" size={16} />
          {callLabel}
        </a>
        <Link
          href={`/${locale}/contact`}
          className="flex flex-1 items-center justify-center gap-2 bg-accent py-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-dark"
        >
          {quoteLabel}
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
