import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-store";
import { sendLeadEmail } from "@/lib/email";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import { getLeads, updateLead } from "@/lib/leads-store";

/**
 * Scheduled follow-up job. Protected by CRON_SECRET (disabled until set). Sends
 * the follow-up template to leads that are still "new", have had no follow-up,
 * and are older than FOLLOWUP_DAYS. Wire to an OS cron / uptime pinger:
 *   GET /api/cron/followups?key=YOUR_CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(process.env.FOLLOWUP_DAYS ?? 2);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const tpl = EMAIL_TEMPLATES.find((x) => x.id === "followup")!;
  const leads = await getLeads();

  let sent = 0;
  for (const l of leads) {
    if (l.status !== "new" || l.lastFollowUpAt || l.createdAt > cutoff) continue;
    const loc = l.locale === "fr" ? "fr" : "en";
    const fill = (str: string) => str.replace("{name}", l.name).replace("{city}", l.city || "");
    await sendLeadEmail(l.email, fill(tpl.subject[loc]), fill(tpl.body[loc]));
    await updateLead(l.id, { lastFollowUpAt: new Date().toISOString(), status: "contacted" });
    sent++;
  }

  if (sent > 0) await logAudit({ action: "auto_followup", role: null, detail: `${sent} sent` });
  return NextResponse.json({ ok: true, sent });
}
