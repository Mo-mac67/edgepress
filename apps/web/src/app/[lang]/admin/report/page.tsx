import Link from "next/link";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { PrintButton } from "@/components/admin/PrintButton";
import { isLocale } from "@/i18n/config";
import { isAuthed } from "@/lib/admin-auth";
import { computeAnalytics } from "@/lib/analytics";
import { getSettings } from "@/lib/cms-store";
import { getEvents } from "@/lib/events-store";
import { getLeads } from "@/lib/leads-store";

export const dynamic = "force-dynamic";

function Table({ title, rows }: { title: string; rows: { key: string; value: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ breakInside: "avoid" }}>
      <h2 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.slice(0, 10).map((r) => (
            <tr key={r.key} className="border-b border-line">
              <td className="py-1.5 capitalize">{r.key}</td>
              <td className="py-1.5 text-right font-semibold">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  if (!(await isAuthed())) return <AdminLogin />;

  const [leads, events, settings] = await Promise.all([getLeads(), getEvents(), getSettings()]);
  const days = 30;
  const a = computeAnalytics(leads, events, days);
  const recent = [...leads].sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 20);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:py-0">
      <style dangerouslySetInnerHTML={{ __html: "@media print{.no-print{display:none!important}body{background:#fff}} @page{margin:16mm}" }} />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{settings.brandName || "EdgePress"}</p>
          <h1 className="font-display text-2xl font-bold text-brand">Analytics report</h1>
          <p className="text-sm text-ink-soft">Last {days} days · generated {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${lang}/admin`} className="btn-secondary no-print">← Dashboard</Link>
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sessions", a.kpis.sessions],
          ["Page views", a.kpis.pageviews],
          ["Leads", a.kpis.leads],
          ["Conversion", `${(a.kpis.conversionRate * 100).toFixed(1)}%`],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-line p-3">
            <p className="text-xs text-ink-soft">{label}</p>
            <p className="font-display text-xl font-bold text-brand">{val}</p>
          </div>
        ))}
      </div>

      <Table title="Leads by status" rows={a.leadsByStatus} />
      <Table title="Leads by project type" rows={a.leadsByProjectType} />
      <Table title="Top pages" rows={a.topPages} />

      <div style={{ breakInside: "avoid" }}>
        <h2 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">Recent leads</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase text-ink-soft"><th className="py-1.5">Name</th><th>City</th><th>Type</th><th className="text-right">When</th></tr></thead>
          <tbody>
            {recent.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-1.5">{l.name}</td>
                <td>{l.city || "—"}</td>
                <td>{l.projectType || "—"}</td>
                <td className="text-right text-ink-soft">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-ink-soft">No leads in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
