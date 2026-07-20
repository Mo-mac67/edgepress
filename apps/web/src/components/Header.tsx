"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { tx, type NavItem, type SiteSettings } from "@/lib/cms-types";

function href(item: NavItem, locale: Locale): string {
  if (item.external || /^https?:\/\//.test(item.href)) return item.href;
  const clean = item.href.replace(/^\//, "");
  return `/${locale}${clean ? `/${clean}` : ""}`;
}

/** Text wordmark derived from the site's brand name (e.g. "EdgePress" or
 *  "Acme.ca" → "Acme" + accented ".ca"). Clean sans, uppercase, letter-spaced. */
function WordMark({ light, name }: { light: boolean; name: string }) {
  const m = name.match(/^(.*?)(\.[a-z]{2,})$/i);
  const base = m ? m[1] : name;
  const suffix = m ? m[2] : "";
  return (
    <span className={`font-sans text-[1.15rem] font-semibold uppercase leading-none tracking-[0.16em] ${light ? "text-white" : "text-brand"}`}>
      {base}
      {suffix && <span className={`ml-1 text-[0.7rem] font-medium tracking-normal ${light ? "text-accent" : "text-accent-dark"}`}>{suffix}</span>}
    </span>
  );
}

export function Header({
  locale,
  dict,
  nav,
  settings,
}: {
  locale: Locale;
  dict: Dictionary;
  nav: NavItem[];
  settings: SiteSettings;
}) {
  const base = `/${locale}`;
  const links = nav.map((item) => ({ href: href(item, locale), label: tx(item.label, locale) }));
  const tel = settings.phone.replace(/[^\d+]/g, "");
  const tagline = tx(settings.headerTagline, locale);

  // Transparent over the hero photo at the top; solidifies (cream + ink) once
  // the page is scrolled a little. Text pages (no dark hero) stay solid so the
  // white text is never invisible over light content.
  const pathname = usePathname();
  const solidPage = /\/(privacy|terms|blog)(\/|$)/.test(pathname || "");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || solidPage;
  const light = !solid; // white content over the photo; ink once solid

  return (
    <header
      className={`no-print fixed inset-x-0 top-0 z-40 transition-colors duration-500 ${
        solid ? "border-b border-line bg-cream/95 backdrop-blur" : "bg-gradient-to-b from-black/45 via-black/15 to-transparent"
      }`}
    >
      <div className="container-page flex h-[5.25rem] items-center justify-between gap-6">
        <Link href={base} className="flex items-center gap-3.5">
          <WordMark light={light} name={settings.brandName} />
          {tagline && (
            <span
              className={`hidden border-l pl-3.5 text-[0.62rem] font-semibold uppercase tracking-[0.24em] xl:inline-block ${
                light ? "border-white/25 text-white/60" : "border-line text-ink-soft"
              }`}
            >
              {tagline}
            </span>
          )}
        </Link>

        {/* Right cluster — generously spaced, editorial */}
        <div className="flex items-center gap-6 sm:gap-8">
          <a
            href={`tel:${tel}`}
            className={`hidden text-xs font-semibold tracking-[0.1em] transition lg:inline-flex ${
              light ? "text-white/85 hover:text-white" : "text-brand hover:text-accent-dark"
            }`}
          >
            {settings.phone}
          </a>
          <LanguageSwitcher locale={locale} locales={settings.locales?.length ? settings.locales : undefined} onDark={light} />
          <Link
            href={`${base}/contact`}
            className={`hidden text-xs font-semibold uppercase tracking-[0.16em] transition sm:inline-flex ${
              light ? "text-white hover:text-accent" : "text-brand hover:text-accent-dark"
            }`}
          >
            {dict.nav.quote}
          </Link>
          <MobileMenu
            links={links}
            ctaHref={`${base}/contact`}
            ctaLabel={dict.nav.quote}
            settings={settings}
            locale={locale}
            light={light}
          />
        </div>
      </div>
    </header>
  );
}
