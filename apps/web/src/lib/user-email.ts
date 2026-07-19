import "server-only";

/**
 * Minimal transactional email sender for site-user flows (password resets).
 * Uses Resend (same provider every site already uses for lead notifications).
 * Env-gated: returns false when RESEND_API_KEY is not configured — callers
 * must surface the link/url to the admin so it can be sent manually.
 */
export async function sendUserEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFY_FROM ?? "no-reply@example.com";
  if (!apiKey) {
    console.info(`[user-email] (not sent — no RESEND_API_KEY)\nTo: ${to}\nSubject: ${subject}\n${text}`);
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
    console.error("[user-email] failed to send", err);
    return false;
  }
}
