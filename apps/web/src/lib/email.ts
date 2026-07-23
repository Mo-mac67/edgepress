import "server-only";
import { EMAIL_TEMPLATES } from "./email-templates";
import type { Lead } from "./types";

/**
 * Lead notification abstraction. If RESEND_API_KEY + LEAD_NOTIFY_TO are set,
 * a real email is sent via Resend. Otherwise the notification is logged so the
 * app works end-to-end with no keys during development.
 */
export async function notifyNewLead(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO;
  const from = process.env.LEAD_NOTIFY_FROM ?? "leads@example.com";

  const subject = `New enquiry: ${lead.name} (${lead.city}, ${lead.projectType})`;
  const lines = [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    `City / area: ${lead.city}`,
    `Project type: ${lead.projectType}`,
    `Budget: ${lead.budget ?? "—"}`,
    `Timeline: ${lead.timeline ?? "—"}`,
    `Preferred call times: ${(lead.preferredTimes ?? []).join(", ") || "—"}`,
    `Message: ${lead.message ?? "—"}`,
  ];

  if (!apiKey || !to) {
    console.info(`[lead-notify] ${subject}\n${lines.join("\n")}`);
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: lines.join("\n"),
      }),
    });
  } catch (err) {
    console.error("[lead-notify] failed to send email", err);
  }
}

/**
 * Sends an automatic acknowledgement to the person who submitted the form, so
 * they know their quote request / message was received. Replies are routed to
 * the business inbox (LEAD_NOTIFY_TO) via reply-to. No-ops (logs only) when no
 * RESEND_API_KEY is configured, so the app still works with no keys.
 */
export async function sendLeadConfirmation(lead: Lead): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM ?? "leads@example.com";
  const replyTo = process.env.LEAD_NOTIFY_TO;

  const tpl = EMAIL_TEMPLATES.find((t) => t.id === "confirmation");
  if (!tpl) return false;
  const loc = lead.locale === "fr" ? "fr" : "en";
  const fill = (str: string) => str.replace(/\{name\}/g, lead.name).replace(/\{city\}/g, lead.city || "");
  const subject = fill(tpl.subject[loc]);
  const text = fill(tpl.body[loc]);

  if (!apiKey) {
    console.info(`[lead-confirm] (not sent — no RESEND_API_KEY)\nTo: ${lead.email}\nSubject: ${subject}\n${text}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: lead.email, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    return res.ok;
  } catch (err) {
    console.error("[lead-confirm] failed to send", err);
    return false;
  }
}

/**
 * Generic notification email (form submissions, system alerts). Logs instead
 * of sending when RESEND_API_KEY is missing so everything works key-free.
 */
export async function sendNotification(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM ?? "notifications@example.com";
  if (!apiKey || !to) {
    console.info(`[notify-email] (not sent — ${apiKey ? "no recipient" : "no RESEND_API_KEY"})\nTo: ${to}\nSubject: ${subject}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return res.ok;
  } catch (err) {
    console.error("[notify-email] failed to send", err);
    return false;
  }
}

/**
 * Sends a follow-up email to a lead from the admin panel. Returns whether a
 * real email was dispatched (false = logged only, e.g. no API key configured).
 */
export async function sendLeadEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM ?? "leads@example.com";
  const replyTo = process.env.LEAD_NOTIFY_TO;

  if (!apiKey) {
    console.info(`[lead-email] (not sent — no RESEND_API_KEY)\nTo: ${to}\nSubject: ${subject}\n${text}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    return res.ok;
  } catch (err) {
    console.error("[lead-email] failed to send", err);
    return false;
  }
}
