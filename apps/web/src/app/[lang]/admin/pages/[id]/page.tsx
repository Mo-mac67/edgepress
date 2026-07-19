import { notFound } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { PageEditor } from "@/components/admin/PageEditor";
import { isLocale } from "@/i18n/config";
import { isAuthed } from "@/lib/admin-auth";
import { getPages } from "@/lib/cms-store";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: PageProps<"/[lang]/admin/pages/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!(await isAuthed())) return <AdminLogin />;

  const page = (await getPages()).find((p) => p.id === id);
  if (!page) notFound();
  return <PageEditor initial={page} uiLocale={lang} />;
}
