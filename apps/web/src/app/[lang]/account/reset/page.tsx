import { notFound } from "next/navigation";
import { ResetForm } from "@/components/marketplace/ResetForm";
import { isLocale } from "@/i18n/config";
import { marketDict } from "@/lib/marketplace-i18n";

export const dynamic = "force-dynamic";

export default async function ResetPage({ params, searchParams }: PageProps<"/[lang]/account/reset">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const a = marketDict(lang).auth;

  return (
    <section className="container-page py-12">
      <h1 className="mb-8 text-center text-3xl font-bold">{a.resetTitle}</h1>
      <ResetForm locale={lang} initialToken={token} />
    </section>
  );
}
