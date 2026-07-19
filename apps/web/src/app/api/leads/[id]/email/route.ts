import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { sendLeadEmail } from "@/lib/email";
import { getLead, updateLead } from "@/lib/leads-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { subject, body } = await request.json().catch(() => ({}));

  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!subject || !body) return NextResponse.json({ error: "Missing subject or body" }, { status: 400 });

  const sent = await sendLeadEmail(lead.email, String(subject), String(body));

  // Record the touch: mark contacted and append a timestamped note.
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const noteLine = `[${stamp}] ${sent ? "Email sent" : "Email logged"}: ${subject}`;
  const notes = lead.notes ? `${lead.notes}\n${noteLine}` : noteLine;
  await updateLead(id, { notes, status: lead.status === "new" ? "contacted" : lead.status, lastFollowUpAt: new Date().toISOString() });

  await logAudit({ action: "lead_email", role, detail: `${lead.name} (${sent ? "sent" : "logged"})` });
  return NextResponse.json({ ok: true, sent });
}
