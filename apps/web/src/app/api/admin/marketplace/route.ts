import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { bidCount, listTenders } from "@/lib/tenders-store";
import {
  adminSetUserPassword,
  createResetToken,
  deleteUser,
  listUsers,
  setBusinessVerified,
} from "@/lib/user-auth";
import { sendUserEmail } from "@/lib/user-email";

/**
 * Admin data + actions for the Marketplace dashboard tab.
 * GET  → { tenders (all, with bidCount), users (all site users) }
 * POST → { action: "verify" | "reset-link" | "set-password" | "remove-user", ... }
 */
export async function GET() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tenders, users] = await Promise.all([listTenders(), listUsers()]);
  const withCounts = await Promise.all(tenders.map(async (t) => ({ ...t, bidCount: await bidCount(t.id) })));
  return NextResponse.json({ tenders: withCounts, users });
}

export async function POST(request: Request) {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const id = String(body.id ?? "");

  if (action === "verify") {
    const ok = await setBusinessVerified(id, !!body.verified);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logAudit({ action: body.verified ? "verify_business" : "unverify_business", role });
    return NextResponse.json({ ok: true });
  }

  if (action === "reset-link") {
    const email = String(body.email ?? "");
    const lang = body.lang === "fr" ? "fr" : "en";
    const created = await createResetToken(email);
    if (!created) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const site = process.env.SITE_URL ?? new URL(request.url).origin;
    const url = `${site}/${lang}/account/reset?token=${created.token}`;
    const subject = lang === "fr" ? "Réinitialisation de votre mot de passe" : "Reset your password";
    const text =
      lang === "fr"
        ? `Bonjour ${created.user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valide 24 h) :\n${url}`
        : `Hi ${created.user.name},\n\nTo choose a new password, open this link (valid for 24 hours):\n${url}`;
    const emailed = await sendUserEmail(created.user.email, subject, text);
    await logAudit({ action: "user_reset_link", role, detail: created.user.email });
    // ALWAYS return the URL so the admin can copy/send it manually.
    return NextResponse.json({ url, emailed });
  }

  if (action === "set-password") {
    const ok = await adminSetUserPassword(id, String(body.password ?? ""));
    if (!ok) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await logAudit({ action: "user_set_password", role });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove-user") {
    const ok = await deleteUser(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logAudit({ action: "user_removed", role });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad action" }, { status: 400 });
}
