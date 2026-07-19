import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketAuthForm } from "@/components/marketplace/MarketAuthForm";
import { MarketSignOutButton } from "@/components/marketplace/MarketSignOutButton";
import { isLocale } from "@/i18n/config";
import { marketDict } from "@/lib/marketplace-i18n";
import { bidsByBusiness, bidCount, getTender, listTenders } from "@/lib/tenders-store";
import { currentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = marketDict(lang);
  const a = d.auth;
  const m = d.market;
  const base = `/${lang}`;

  const user = await currentUser();
  if (!user) {
    return (
      <section className="container-page py-12">
        <h1 className="mb-8 text-center text-3xl font-bold">{a.accountTitle}</h1>
        <MarketAuthForm locale={lang} />
      </section>
    );
  }

  const isBusiness = user.role === "business";
  const money = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  const myTenders = !isBusiness ? await listTenders({ ownerId: user.id }) : [];
  const tendersWithCounts = await Promise.all(myTenders.map(async (t) => ({ ...t, bidCount: await bidCount(t.id) })));

  const myBids = isBusiness ? await bidsByBusiness(user.id) : [];
  const bidTenders = await Promise.all(myBids.map(async (b) => ({ bid: b, tender: await getTender(b.tenderId) })));

  return (
    <section className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-black/5 text-lg font-bold">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{isBusiness ? user.business?.company : user.name}</h1>
            <p className="text-sm text-ink-soft">
              {a.signedInAs} {user.email}
              {isBusiness && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${user.business?.verified ? "bg-black/10" : "bg-black/5 text-ink-soft"}`}>
                  {user.business?.verified ? a.verifiedBadge : a.pendingBadge}
                </span>
              )}
            </p>
          </div>
        </div>
        <MarketSignOutButton label={a.signOut} />
      </div>

      {isBusiness && !user.business?.verified && (
        <p className="mt-5 rounded-xl border border-line bg-black/5 p-4 text-sm text-ink-soft">{a.pendingNote}</p>
      )}

      {/* Client: my projects */}
      {!isBusiness && (
        <>
          <h2 className="mt-10 text-xl font-bold">{m.myTenders}</h2>
          {tendersWithCounts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              {m.noMyTenders}{" "}
              <Link href={`${base}/tenders/new`} className="font-semibold text-ink hover:underline">
                {m.post} →
              </Link>
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {tendersWithCounts.map((t) => (
                <Link key={t.id} href={`${base}/tenders/${t.id}`} className="card block p-5 transition hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold">{m.statuses[t.status]}</span>
                    <span className="text-xs text-ink-soft">{t.bidCount} {m.bids}</span>
                  </div>
                  <h3 className="mt-2 font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    {m.budget}: {money.format(t.totalMin)} – {money.format(t.totalMax)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Provider: my bids */}
      {isBusiness && (
        <>
          <h2 className="mt-10 text-xl font-bold">{m.myBids}</h2>
          {bidTenders.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              {m.noMyBids}{" "}
              <Link href={`${base}/tenders`} className="font-semibold text-ink hover:underline">
                {m.title} →
              </Link>
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {bidTenders.map(({ bid, tender }) => (
                <Link key={bid.id} href={`${base}/tenders/${bid.tenderId}`} className="card block p-5 transition hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{money.format(bid.amount)}</span>
                    {tender && <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold">{m.statuses[tender.status]}</span>}
                  </div>
                  <h3 className="mt-2 font-semibold">{tender?.title ?? "—"}</h3>
                  {tender?.location && <p className="mt-1 text-sm text-ink-soft">{tender.location}</p>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
