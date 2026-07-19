import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { sendLeadConfirmation } from "@/lib/email";
import { createLead, getLeads } from "@/lib/leads-store";
import { notifyLead } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { checkEmail, checkPhone, emailDomain } from "@/lib/validation";
import { isLocale } from "@/i18n/config";
import { PROJECT_TYPES, type ProjectType } from "@/lib/types";

export async function POST(request: Request) {
  if (!rateLimit(`leads:${clientIp(request)}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (body.hp) return NextResponse.json({ id: "ok" }, { status: 201 });

  if (!(await verifyRecaptcha(body.recaptchaToken))) {
    return NextResponse.json({ error: "Failed spam check" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name", reason: "name" }, { status: 422 });
  }

  const phoneCheck = checkPhone(String(body.phone ?? ""));
  if (!phoneCheck.ok) {
    return NextResponse.json({ error: "Invalid phone", reason: "phone" }, { status: 422 });
  }

  const emailCheck = checkEmail(email);
  if (!emailCheck.ok) {
    return NextResponse.json(
      { error: "Invalid email", reason: emailCheck.reason === "disposable" ? "disposable" : "email" },
      { status: 422 },
    );
  }

  if (!(await emailDomainDeliverable(emailDomain(email)))) {
    return NextResponse.json({ error: "Undeliverable email", reason: "undeliverable" }, { status: 422 });
  }

  const phone = phoneCheck.normalized ?? String(body.phone ?? "").trim();

  const projectType: ProjectType = PROJECT_TYPES.includes(body.projectType)
    ? (body.projectType as ProjectType)
    : "other";

  const lead = await createLead({
    locale: isLocale(body.locale) ? body.locale : "en",
    name,
    phone,
    email,
    city: String(body.city ?? "").trim().slice(0, 80),
    projectType,
    budget: body.budget ? String(body.budget).trim().slice(0, 60) : undefined,
    timeline: body.timeline ? String(body.timeline).trim().slice(0, 60) : undefined,
    message: body.message ? String(body.message).trim().slice(0, 2000) : undefined,
    preferredTimes: Array.isArray(body.preferredTimes) ? body.preferredTimes.map(String).slice(0, 6) : [],
  });

  // Notify the business and send the submitter an acknowledgement, in parallel.
  // Both are best-effort — a delivery hiccup must never fail the submission.
  await Promise.allSettled([notifyLead(lead), sendLeadConfirmation(lead)]);
  return NextResponse.json({ id: lead.id }, { status: 201 });
}

async function verifyRecaptcha(token?: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret || !token) return true; // disabled, or client token not wired yet
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json();
    return Boolean(data.success) && (data.score === undefined || data.score >= 0.5);
  } catch {
    return true; // never block a real lead on a verification outage
  }
}

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leads = await getLeads();
  return NextResponse.json({ leads });
}

/**
 * Confirms the email domain can actually receive mail (has MX records). Rejects
 * non-existent domains; fails open on transient network/DNS errors so a real
 * lead is never lost because of a lookup hiccup.
 */
async function emailDomainDeliverable(domain: string): Promise<boolean> {
  if (!domain) return false;
  try {
    // node:dns is unavailable on Cloudflare Workers — import lazily and fail open there.
    const { resolveMx } = await import("node:dns/promises");
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOTFOUND" || code === "ENODATA") return false;
    return true; // transient DNS error, or node:dns absent on Workers
  }
}
