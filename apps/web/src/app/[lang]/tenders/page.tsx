import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { isLocale } from "@/i18n/config";
import { marketDict } from "@/lib/marketplace-i18n";
import { bidCount, listTenders } from "@/lib/tenders-store";

export const dynamic = "force-dynamic";

export default async function TendersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const m = marketDict(lang).market;
  const base = `/${lang}`;

  const tenders = await listTenders({ status: "open" });
  const withCounts = await Promise.all(tenders.map(async (t) => ({ ...t, bidCount: await bidCount(t.id) })));
  const money = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  return (
    <section className="container-page py-12">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold">{m.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{m.subtitle}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={`${base}/tenders/new`} className="btn-primary">
            {m.post}
            <Icon name="arrow-right" size={18} />
          </Link>
          <Link href={`${base}/account`} className="btn-secondary">
            {m.account}
          </Link>
        </div>
      </div>

      {withCounts.length === 0 ? (
        <p className="mt-14 text-center text-ink-soft">{m.noTenders}</p>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {withCounts.map((t) => (
            <Link key={t.id} href={`${base}/tenders/${t.id}`} className="card group flex flex-col p-5 transition hover:shadow-md">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold">
                  {m.categories[t.category] ?? t.category}
                </span>
                {t.location && (
                  <span className="flex items-center gap-1 text-xs text-ink-soft">
                    <Icon name="map-pin" size={14} />
                    {t.location}
                  </span>
                )}
              </div>
              <h3 className="mt-3 flex-1 font-semibold leading-snug">{t.title}</h3>
              {t.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {t.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded bg-black/5 px-1.5 py-0.5 text-xs text-ink-soft">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="font-semibold">
                  {money.format(t.totalMin)} – {money.format(t.totalMax)}
                </span>
                <span className="text-ink-soft">{t.bidCount} {m.bids}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-12 text-center text-xs text-ink-soft">{m.disclaimer}</p>
    </section>
  );
}
