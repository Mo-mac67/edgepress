import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getSubscribers, recordCampaign, unsubscribeToken } from "@/lib/newsletter-store";

/**
 * Sends a campaign to every subscriber via Resend's batch endpoint (chunks of
 * 100). Each email carries a signed unsubscribe link. Without RESEND_API_KEY
 * the campaign is logged, not sent — same key-free behaviour as all email.
 * Owner only: mass email is not a team-member action.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const subject = String(body.subject ?? "").trim().slice(0, 150);
  const text = String(body.body ?? "").trim().slice(0, 50_000);
  if (!subject || !text) return NextResponse.json({ error: "Subject and body are required" }, { status: 422 });

  const subs = await getSubscribers();
  if (subs.length === 0) return NextResponse.json({ error: "No subscribers yet" }, { status: 422 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM ?? "newsletter@example.com";
  const site = process.env.SITE_URL ?? "";
  let delivered = false;

  if (apiKey) {
    // Workers subrequest budget: 100 emails per batch call, max 20 calls here.
    const CHUNK = 100;
    const MAX_CHUNKS = 20;
    const chunks: typeof subs[] = [];
    for (let i = 0; i < subs.length && chunks.length < MAX_CHUNKS; i += CHUNK) chunks.push(subs.slice(i, i + CHUNK));
    for (const chunk of chunks) {
      const payload = chunk.map((s) => ({
        from,
        to: s.email,
        subject,
        text: `${text}\n\n—\nUnsubscribe: ${site}/api/newsletter/unsubscribe?email=${encodeURIComponent(s.email)}&token=${unsubscribeToken(s.email)}`,
      }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return NextResponse.json({ error: `Send failed (${res.status}) — campaign aborted` }, { status: 502 });
    }
    delivered = true;
  } else {
    console.info(`[newsletter] (not sent — no RESEND_API_KEY)\nSubject: ${subject}\nRecipients: ${subs.length}\n${text.slice(0, 500)}`);
  }

  const campaign = await recordCampaign({ subject, recipients: subs.length, delivered });
  await logAudit({ action: "newsletter_send", role: "super", detail: `${subject} → ${subs.length}` });
  return NextResponse.json({ ok: true, campaign });
}
