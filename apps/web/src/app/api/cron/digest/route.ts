import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-store";
import { sendLeadEmail } from "@/lib/email";
import { getLeads } from "@/lib/leads-store";
import { getForms, getSubmissions } from "@/lib/forms-store";

/**
 * Weekly digest job. Protected by CRON_SECRET (disabled until set). Summarizes
 * the last 7 days of leads + form submissions and emails it to LEAD_NOTIFY_TO.
 * Wire to any scheduler:  GET /api/cron/digest?key=YOUR_CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const leads = await getLeads();
  const newLeads = leads.filter((l) => l.createdAt >= since);

  const forms = await getForms();
  let newSubs = 0;
  for (const f of forms) newSubs += (await getSubmissions(f.slug)).filter((s) => s.createdAt >= since).length;

  const summary = {
    period: "last 7 days",
    newLeads: newLeads.length,
    totalLeads: leads.length,
    newFormSubmissions: newSubs,
    topLeads: newLeads.slice(0, 10).map((l) => ({ name: l.name, city: l.city, projectType: l.projectType })),
  };

  const to = process.env.LEAD_NOTIFY_TO;
  let emailed = false;
  if (to) {
    const lines = [
      `Weekly digest — ${new Date().toLocaleDateString()}`,
      ``,
      `New leads (7d): ${summary.newLeads}  (total ${summary.totalLeads})`,
      `New form submissions (7d): ${summary.newFormSubmissions}`,
      ``,
      ...newLeads.slice(0, 10).map((l) => `• ${l.name}${l.city ? ` — ${l.city}` : ""}${l.projectType ? ` (${l.projectType})` : ""}`),
    ];
    try {
      await sendLeadEmail(to, `Weekly digest: ${summary.newLeads} new lead(s)`, lines.join("\n"));
      emailed = true;
    } catch {
      /* email best-effort */
    }
  }

  await logAudit({ action: "weekly_digest", role: null, detail: `${summary.newLeads} leads, ${summary.newFormSubmissions} submissions` });
  return NextResponse.json({ ok: true, emailed, summary });
}
