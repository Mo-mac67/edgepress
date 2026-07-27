import { NextResponse } from "next/server";
import { hashPassword, isTotpEnabled, memberNeeds2fa, setAuthCookie, verifyCredentials, verifyMemberTotp, verifyOwnerTotp } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { clientIp, rateLimitDurable } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!(await rateLimitDurable(`login:${clientIp(request)}`, 10, 60))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const { username, password, code } = await request.json().catch(() => ({}));
  // Username is optional (backward-compatible): blank = password-only login.
  const role = await verifyCredentials(username ? String(username) : undefined, String(password ?? ""));
  if (!role) {
    await logAudit({ action: "login_failed", role: null });
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const uname = username ? String(username) : undefined;
  const pw = String(password ?? "");
  // Second factor. The owner uses config 2FA; a team member can enable their own.
  if (role === "super" && (await isTotpEnabled())) {
    if (!code) return NextResponse.json({ needsCode: true }); // password OK, ask for the code
    if (!(await verifyOwnerTotp(String(code)))) {
      await logAudit({ action: "login_2fa_failed", role });
      return NextResponse.json({ error: "Invalid authentication code", needsCode: true }, { status: 401 });
    }
  } else if (role === "admin" && (await memberNeeds2fa(uname, pw))) {
    if (!code) return NextResponse.json({ needsCode: true });
    if (!(await verifyMemberTotp(uname, pw, String(code)))) {
      await logAudit({ action: "login_2fa_failed", role });
      return NextResponse.json({ error: "Invalid authentication code", needsCode: true }, { status: 401 });
    }
  }

  await setAuthCookie(role, hashPassword(String(password ?? "")));
  await logAudit({ action: "login", role });
  return NextResponse.json({ ok: true, role });
}
