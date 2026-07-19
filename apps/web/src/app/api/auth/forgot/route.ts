import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createResetToken } from "@/lib/user-auth";
import { sendUserEmail } from "@/lib/user-email";

/**
 * Public "forgot password" endpoint. Always answers {ok:true} (no account
 * enumeration). When the account exists, a reset link is created and emailed
 * (if email is configured); otherwise the admin can generate one from the
 * dashboard's Marketplace panel.
 */
export async function POST(request: Request) {
  if (!rateLimit(`forgot:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const lang = body.lang === "fr" ? "fr" : "en";
  if (!email) return NextResponse.json({ ok: true });

  const created = await createResetToken(email);
  if (created) {
    const site = process.env.SITE_URL ?? new URL(request.url).origin;
    const url = `${site}/${lang}/account/reset?token=${created.token}`;
    const subject = lang === "fr" ? "Réinitialisation de votre mot de passe" : "Reset your password";
    const text =
      lang === "fr"
        ? `Bonjour ${created.user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valide 24 h) :\n${url}\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.`
        : `Hi ${created.user.name},\n\nTo choose a new password, open this link (valid for 24 hours):\n${url}\n\nIf you didn't request this reset, you can ignore this email.`;
    await sendUserEmail(created.user.email, subject, text);
  }
  return NextResponse.json({ ok: true });
}
