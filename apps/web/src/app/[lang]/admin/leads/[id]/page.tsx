import { notFound } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { LeadDetail } from "@/components/admin/LeadDetail";
import { AdminUIProvider } from "@/components/admin/ui";
import { isLocale } from "@/i18n/config";
import { isAuthed } from "@/lib/admin-auth";
import { getLead, updateLead } from "@/lib/leads-store";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  if (!(await isAuthed())) return <AdminLogin />;

  const lead = await getLead(id);
  if (!lead) notFound();
  if (!lead.read) await updateLead(lead.id, { read: true });

  return (
    <AdminUIProvider>
      <LeadDetail lead={lead} locale={lang} />
    </AdminUIProvider>
  );
}
