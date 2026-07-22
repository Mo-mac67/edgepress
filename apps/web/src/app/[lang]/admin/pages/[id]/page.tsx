import { notFound } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { PageEditor } from "@/components/admin/PageEditor";
import { AdminUIProvider } from "@/components/admin/ui";
import { isLocale } from "@/i18n/config";
import { isAuthed } from "@/lib/admin-auth";
import { getActiveLocales, getPages } from "@/lib/cms-store";
import { staleLocales } from "@/lib/ai/features";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: PageProps<"/[lang]/admin/pages/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!(await isAuthed())) return <AdminLogin />;

  const page = (await getPages()).find((p) => p.id === id);
  if (!page) notFound();
  const contentLocales = await getActiveLocales();
  return (
    <AdminUIProvider>
      <PageEditor initial={page} uiLocale={lang} contentLocales={contentLocales} staleLocales={staleLocales(page, contentLocales)} />
    </AdminUIProvider>
  );
}
