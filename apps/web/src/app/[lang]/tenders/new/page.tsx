import { notFound } from "next/navigation";
import { NewTenderForm } from "@/components/marketplace/NewTenderForm";
import { isLocale } from "@/i18n/config";
import { marketDict } from "@/lib/marketplace-i18n";
import { currentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function NewTenderPage({ params }: PageProps<"/[lang]/tenders/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const m = marketDict(lang).market;
  const user = await currentUser();

  return (
    <section className="container-page py-12">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold">{m.postTitle}</h1>
        <p className="mt-3 text-ink-soft">{m.postSubtitle}</p>
      </div>
      <div className="mx-auto mt-8 max-w-2xl">
        <NewTenderForm locale={lang} signedIn={!!user} />
      </div>
    </section>
  );
}
