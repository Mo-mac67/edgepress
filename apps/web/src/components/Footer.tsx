import Link from "next/link";
import { BusinessHours } from "./BusinessHours";
import { Icon } from "./Icon";
import { SocialLinks } from "./SocialLinks";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { tx, type NavItem, type SiteSettings } from "@/lib/cms-types";

function href(item: NavItem, locale: Locale): string {
  if (item.external || /^https?:\/\//.test(item.href)) return item.href;
  const clean = item.href.replace(/^\//, "");
  return `/${locale}${clean ? `/${clean}` : ""}`;
}

export function Footer({
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
  const tel = settings.phone.replace(/[^\d+]/g, "");
  // Each service deep-links to its section on the /services page (anchors set on
  // the gallery cards in BlockRenderer), so these are distinct destinations —
  // not five links to the same page.
  const serviceLinks: [string, string][] =
    locale === "fr"
      ? [
          ["Maisons sur mesure", "custom-homes"],
          ["Rénovations de cuisine", "kitchen-renovations"],
          ["Aménagement de sous-sol", "basement-finishing"],
          ["Agrandissements", "home-additions"],
          ["Rénovations complètes", "whole-home-renovations"],
          ["Salles de bain et intérieurs", "bathrooms-interiors"],
        ]
      : [
          ["Custom Homes", "custom-homes"],
          ["Kitchen Renovations", "kitchen-renovations"],
          ["Basement Finishing", "basement-finishing"],
          ["Home Additions", "home-additions"],
          ["Whole-Home Renovations", "whole-home-renovations"],
          ["Bathrooms & Interiors", "bathrooms-interiors"],
        ];

  // Company column is a sitemap: drop Home (the wordmark already links home) and
  // Services (it has its own column) so nothing is listed twice.
  const companyNav = nav.filter((item) => item.href !== "" && item.href.replace(/^\//, "") !== "services");
  return (
    <footer className="no-print bg-brand-dark text-white/85">
      <div className="container-page grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center">
            <span className="font-sans text-xl font-semibold uppercase leading-none tracking-[0.16em] text-white">
              {(() => {
                const m = settings.brandName.match(/^(.*?)(\.[a-z]{2,})$/i);
                return (
                  <>
                    {m ? m[1] : settings.brandName}
                    {m && <span className="ml-1 text-sm font-medium tracking-normal text-accent">{m[2]}</span>}
                  </>
                );
              })()}
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{tx(settings.footerTagline, locale)}</p>
          <p className="mt-4 text-xs font-semibold text-accent">{tx(settings.licenseNote, locale)}</p>
          <SocialLinks settings={settings} className="mt-6 text-white/85" />
        </div>

        <div className="text-sm">
          <p className="mb-4 font-display font-bold text-white">{dict.footer.servicesTitle}</p>
          <ul className="space-y-2.5">
            {serviceLinks.map(([label, anchor]) => (
              <li key={anchor}>
                <Link href={`${base}/services#${anchor}`} className="hover:text-white">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-4 font-display font-bold text-white">{dict.footer.quickLinksTitle}</p>
          <ul className="space-y-2.5">
            {companyNav.map((item) => (
              <li key={item.id}>
                <Link href={href(item, locale)} className="hover:text-white">{tx(item.label, locale)}</Link>
              </li>
            ))}
            <li><Link href={`${base}/privacy`} className="hover:text-white">{dict.legal.privacyTitle}</Link></li>
            <li><Link href={`${base}/terms`} className="hover:text-white">{dict.legal.termsTitle}</Link></li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="mb-4 font-display font-bold text-white">{dict.footer.contactTitle}</p>
          <ul className="space-y-3">
            <li className="flex items-start gap-2.5"><Icon name="phone" size={17} className="mt-0.5 shrink-0 text-accent" /><a href={`tel:${tel}`} className="hover:text-white">{settings.phone}</a></li>
            <li className="flex items-start gap-2.5"><Icon name="mail" size={17} className="mt-0.5 shrink-0 text-accent" /><a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a></li>
            <li className="flex items-start gap-2.5"><Icon name="map-pin" size={17} className="mt-0.5 shrink-0 text-accent" /><span>{settings.address}</span></li>
            <li><BusinessHours locale={locale} tone="dark" /></li>
          </ul>
        </div>
      </div>

      {/* Service-area links — internal linking for the local-SEO area pages. */}
      <div className="border-t border-line-dark">
        <div className="container-page flex flex-wrap items-center gap-x-2 gap-y-1.5 py-4 text-xs text-white/50">
          <span className="mr-1 font-semibold uppercase tracking-[0.14em] text-white/40">
            {locale === "fr" ? "Au service de" : "Serving"}
          </span>
          {[
            ["Toronto", "toronto"],
            ["North York", "north-york"],
            ["Etobicoke", "etobicoke"],
            ["Scarborough", "scarborough"],
            ["Vaughan", "vaughan"],
            ["Markham", "markham"],
            ["Richmond Hill", "richmond-hill"],
          ].map(([name, slug], i) => (
            <span key={slug} className="flex items-center gap-2">
              {i > 0 && <span className="text-white/25">·</span>}
              <Link href={`${base}/areas/${slug}`} className="hover:text-white">{name}</Link>
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-line-dark">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {settings.brandName}. {dict.footer.rights}</p>
          <a href="https://synergion.ca" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
            Synergion.ca
          </a>
        </div>
      </div>
    </footer>
  );
}
