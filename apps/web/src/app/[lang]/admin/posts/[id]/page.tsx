import { notFound } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { PostEditor } from "@/components/admin/PostEditor";
import { AdminUIProvider } from "@/components/admin/ui";
import { isLocale } from "@/i18n/config";
import { isAuthed } from "@/lib/admin-auth";
import { getActiveLocales, getPosts } from "@/lib/cms-store";

export const dynamic = "force-dynamic";

export default async function EditPost({ params }: PageProps<"/[lang]/admin/posts/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!(await isAuthed())) return <AdminLogin />;

  const post = (await getPosts()).find((p) => p.id === id);
  if (!post) notFound();
  return (
    <AdminUIProvider>
      <PostEditor initial={post} uiLocale={lang} contentLocales={await getActiveLocales()} />
    </AdminUIProvider>
  );
}
