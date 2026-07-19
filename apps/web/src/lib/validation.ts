/**
 * Shared (client + server) validation for lead contact details. The server
 * additionally runs an MX DNS check — see app/api/leads/route.ts.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Common disposable / throwaway email domains to reject. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "yopmail.com", "throwawaymail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc",
  "fakeinbox.com", "mailnesia.com", "mintemail.com", "spam4.me",
  "discard.email", "tempmailo.com", "moakt.com", "emailondeck.com",
]);

export function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

export type EmailCheck = { ok: boolean; reason?: "format" | "disposable" };

export function checkEmail(email: string): EmailCheck {
  const value = (email ?? "").trim();
  if (!EMAIL_RE.test(value)) return { ok: false, reason: "format" };
  if (DISPOSABLE_EMAIL_DOMAINS.has(emailDomain(value))) {
    return { ok: false, reason: "disposable" };
  }
  return { ok: true };
}

export type PhoneCheck = { ok: boolean; normalized?: string };

/**
 * Validates a North American (Canadian) phone number. Enforces the NANP rule
 * that area code and exchange code start with 2–9, which rejects obviously fake
 * numbers like 000-000-0000 or 111-111-1111.
 */
export function checkPhone(phone: string): PhoneCheck {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return { ok: false };

  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  if (area[0] < "2" || exchange[0] < "2") return { ok: false };
  if (/^(\d)\1{9}$/.test(digits)) return { ok: false };

  const normalized = `(${area}) ${exchange}-${digits.slice(6)}`;
  return { ok: true, normalized };
}
