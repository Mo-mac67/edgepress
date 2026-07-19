import Link from "next/link";
import { Icon } from "./Icon";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** Reusable "Get a quote" call-to-action band. */
export function CtaBand({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className="bg-brand">
      <div className="container-page py-16 text-center md:py-20">
        <h2 className="section-title mx-auto max-w-2xl text-white">{dict.home.ctaTitle}</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/75">{dict.home.ctaSubtitle}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${locale}/contact`} className="btn-primary">
            {dict.home.ctaButton}
            <Icon name="arrow-right" size={18} />
          </Link>
          <a href={`tel:${dict.common.phone.replace(/[^\d+]/g, "")}`} className="btn-ghost-light">
            <Icon name="phone" size={17} />
            {dict.common.phone}
          </a>
        </div>
      </div>
    </section>
  );
}

/** Client testimonials grid. */
export function Testimonials({ dict }: { dict: Dictionary }) {
  return (
    <section className="bg-sand">
      <div className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">★★★★★</span>
          <h2 className="section-title mt-3">{dict.testimonials.title}</h2>
          <p className="mt-4 text-ink-soft">{dict.testimonials.subtitle}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {dict.testimonials.items.map((t, i) => (
            <figure key={i} className="card flex flex-col p-7 shadow-sm">
              <Icon name="quote" size={30} className="text-accent" />
              <blockquote className="mt-4 flex-1 text-[1.02rem] leading-relaxed text-ink">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-line pt-4">
                <p className="font-display font-bold text-brand">{t.author}</p>
                <p className="text-sm text-ink-soft">
                  {t.role} · {t.location}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Licenses, certifications, awards and memberships. */
export function Credentials({ dict, compact = false }: { dict: Dictionary; compact?: boolean }) {
  const c = dict.credentials;
  return (
    <section className="bg-white">
      <div className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">
            <Icon name="shield" size={15} />
            {c.title}
          </span>
          <h2 className="section-title mt-3">{c.title}</h2>
          <p className="mt-4 text-ink-soft">{c.subtitle}</p>
        </div>

        {/* Licenses */}
        <div className="mt-12">
          <h3 className="font-display text-lg font-bold text-brand">{c.licenses.title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{c.licenses.subtitle}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.licenses.items.map((l) => (
              <div key={l.name} className="card flex items-start gap-3 p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name="shield" size={20} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{l.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications + Awards */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-brand">
              <Icon name="check" size={20} className="text-accent-dark" />
              {c.certifications.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {c.certifications.items.map((cert) => (
                <li key={cert.name} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent-dark" />
                  <div>
                    <p className="font-medium text-ink">{cert.name}</p>
                    <p className="text-xs text-ink-soft">{cert.org}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-brand">
              <Icon name="award" size={20} className="text-accent-dark" />
              {c.awards.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {c.awards.items.map((a) => (
                <li key={a.name} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-dark">
                    <Icon name="award" size={18} />
                  </span>
                  <div>
                    <p className="font-medium text-ink">{a.name}</p>
                    <p className="text-xs text-ink-soft">{a.org} · {a.year}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Memberships */}
        {!compact && (
          <div className="mt-10 rounded-2xl border border-line bg-sand p-7 text-center">
            <h3 className="font-display text-lg font-bold text-brand">{c.memberships.title}</h3>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {c.memberships.items.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-brand"
                >
                  <Icon name="star" size={15} className="text-accent" />
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
