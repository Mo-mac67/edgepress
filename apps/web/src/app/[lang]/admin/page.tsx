import { notFound } from "next/navigation";
import { AdminApp } from "@/components/admin/AdminApp";
import { isLocale } from "@/i18n/config";
import { getAdminPath } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  // If the owner moved the admin to a custom URL, the default /admin is disabled
  // (served instead by the [...slug] catch-all at the configured path).
  if ((await getAdminPath()) !== "admin") notFound();
  return <AdminApp lang={lang} />;
}
