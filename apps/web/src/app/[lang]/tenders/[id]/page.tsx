import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { TenderActions } from "@/components/marketplace/TenderActions";
import { isLocale } from "@/i18n/config";
import { getRole } from "@/lib/admin-auth";
import { marketDict } from "@/lib/marketplace-i18n";
import { bidsForTender, getTender } from "@/lib/tenders-store";
import { currentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function TenderDetailPage({ params }: PageProps<"/[lang]/tenders/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const m = marketDict(lang).market;
  const base = `/${lang}`;

  const tender = await getTender(id);
  if (!tender) notFound();

  const [user, adminRole, bids] = await Promise.all([currentUser(), getRole(), bidsForTender(id)]);
  const isOwner = user?.id === tender.ownerId;
  const isAdmin = adminRole !== null;
  // Non-owners can only see open/awarded projects (pending ones stay hidden).
  if (tender.status === "pending" && !isOwner && !isAdmin) notFound();

  const money = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  const myBid = user?.role === "business" ? (bids.find((b) => b.businessId === user.id) ?? null) : null;

  return (
    <section className="container-page py-10">
      <Link href={`${base}/tenders`} className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
        <Icon name="arrow-left" size={16} />
        {m.back}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold">{m.statuses[tender.status]}</span>
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold">{m.categories[tender.category] ?? tender.category}</span>
            {tender.location && (
              <span className="flex items-center gap-1 text-xs text-ink-soft">
                <Icon name="map-pin" size={14} />
                {tender.location}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold">{tender.title}</h1>
          {tender.description && <p className="mt-2 max-w-2xl text-ink-soft">{tender.description}</p>}
        </div>
        <div className="rounded-xl border border-line bg-black/5 p-4 text-right">
          <p className="text-xs text-ink-soft">{m.budget}</p>
          <p className="text-xl font-bold">{money.format(tender.totalMin)} – {money.format(tender.totalMax)}</p>
        </div>
      </div>

      {/* Scope */}
      {tender.lines.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-bold">{m.scope}</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <tbody>
                {tender.lines.map((l, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{l.label}</span>
                      {l.detail && <span className="ml-2 text-xs text-ink-soft">{l.detail}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{money.format(l.min)} – {money.format(l.max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tender.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tender.tags.map((tag) => (
            <span key={tag} className="rounded bg-black/5 px-1.5 py-0.5 text-xs text-ink-soft">
              {tag}
            </span>
          ))}
        </div>
      )}

      <TenderActions
        locale={lang}
        tenderId={tender.id}
        status={tender.status}
        isOwner={isOwner}
        viewer={user ? { role: user.role, verified: user.business?.verified ?? false } : null}
        bids={isOwner || isAdmin ? bids : null}
        bidCount={bids.length}
        myBid={myBid}
      />

      <p className="mt-10 text-xs text-ink-soft">{m.disclaimer}</p>
    </section>
  );
}
