import { Icon, type IconName } from "./Icon";
import type { Locale } from "@/i18n/config";
import { tx, type SiteSettings } from "@/lib/cms-types";

/**
 * Bold, prominent licenses & credentials band — rendered site-wide (above the
 * footer) so it always appears regardless of CMS/KV content. This is the trust
 * layer a Toronto/GTA builder leads with.
 */
export function Credentials({ locale, settings }: { locale: Locale; settings: SiteSettings }) {
  const fr = locale === "fr";
  const items: { icon: IconName; title: string; sub: string }[] = [
    { icon: "shield", title: fr ? "Constructeur licencié HCRA" : "HCRA Licensed Builder", sub: fr ? "Autorité de réglementation" : "Home Construction Regulatory Authority" },
    { icon: "check", title: fr ? "Garantie Tarion" : "Tarion Warranty", sub: fr ? "Garantie des maisons neuves de l'Ontario" : "Ontario New Home Warranty" },
    { icon: "shield", title: fr ? "Couvert par la CSPAAT" : "WSIB Cleared", sub: fr ? "Travailleurs pleinement couverts" : "Workers fully covered" },
    { icon: "award", title: fr ? "Assuré et cautionné" : "Fully Insured & Bonded", sub: fr ? "Responsabilité civile de 5 M$" : "$5M liability coverage" },
    { icon: "hammer", title: fr ? "Plus de 20 ans dans la RGT" : "20+ Years in the GTA", sub: fr ? "Des centaines de projets livrés" : "Hundreds of projects delivered" },
  ];
  const note = tx(settings.licenseNote, locale);

  return (
    <section className="cred-band no-print text-white">
      <div className="container-page relative py-14 md:py-16">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="rule-accent mb-4" />
            <h2 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.02em] md:text-[2.6rem]">
              {fr ? "Licencié. Assuré. Responsable." : "Licensed. Insured. Accountable."}
            </h2>
          </div>
          {note && (
            <p className="max-w-sm text-sm font-semibold uppercase tracking-[0.12em] text-accent">{note}</p>
          )}
        </div>

        <div className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => (
            <div key={it.title} className="cred-badge flex flex-col gap-2.5 p-5">
              <span className="grid h-10 w-10 place-items-center text-accent">
                <Icon name={it.icon} size={24} />
              </span>
              <p className="font-display text-[0.98rem] font-extrabold leading-tight">{it.title}</p>
              <p className="text-[11px] leading-snug text-white/60">{it.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
