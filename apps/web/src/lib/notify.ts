import "server-only";
import { notifyNewLead } from "./email";
import type { Lead } from "./types";

/**
 * Fan-out new-lead notifications. Each channel is independent and pluggable:
 * email (Resend), Telegram, and a generic CRM webhook (Zapier / Make / HubSpot /
 * GoHighLevel). All no-op silently if their env vars are missing.
 */
export async function notifyLead(lead: Lead): Promise<void> {
  await Promise.allSettled([notifyNewLead(lead), telegram(lead), sms(lead), whatsapp(lead), crmWebhook(lead)]);
}

export interface NotificationChannels {
  email: boolean;
  telegram: boolean;
  sms: boolean;
  whatsapp: boolean;
  crm: boolean;
}

/** Which notification channels are currently configured (for the admin panel). */
export function notificationChannels(): NotificationChannels {
  const twilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  return {
    email: !!(process.env.RESEND_API_KEY && process.env.LEAD_NOTIFY_TO),
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    sms: twilio && !!(process.env.TWILIO_SMS_FROM && process.env.SMS_NOTIFY_TO),
    whatsapp: twilio && !!(process.env.TWILIO_WHATSAPP_FROM && process.env.WHATSAPP_NOTIFY_TO),
    crm: !!process.env.CRM_WEBHOOK_URL,
  };
}

function summary(lead: Lead): string {
  return `New enquiry: ${lead.name} | ${lead.phone} | ${lead.city} | ${lead.projectType}`;
}

async function twilioSend(from: string, to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !from || !to) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    });
  } catch (err) {
    console.error("[notify] twilio failed", err);
  }
}

async function sms(lead: Lead): Promise<void> {
  await twilioSend(process.env.TWILIO_SMS_FROM ?? "", process.env.SMS_NOTIFY_TO ?? "", summary(lead));
}

async function whatsapp(lead: Lead): Promise<void> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.WHATSAPP_NOTIFY_TO;
  if (!from || !to) return;
  const w = (n: string) => (n.startsWith("whatsapp:") ? n : `whatsapp:${n}`);
  await twilioSend(w(from), w(to), summary(lead));
}

async function telegram(lead: Lead): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text =
    `🏗️ New enquiry: ${lead.name}\n` +
    `📞 ${lead.phone}\n✉️ ${lead.email}\n` +
    `📍 ${lead.city}\n` +
    `🔨 ${lead.projectType}${lead.budget ? ` · ${lead.budget}` : ""}${lead.timeline ? ` · ${lead.timeline}` : ""}`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("[notify] telegram failed", err);
  }
}

async function crmWebhook(lead: Lead): Promise<void> {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch (err) {
    console.error("[notify] CRM webhook failed", err);
  }
}
