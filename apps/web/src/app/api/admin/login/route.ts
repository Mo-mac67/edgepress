import { NextResponse } from "next/server";
import { hashPassword, isTotpEnabled, setAuthCookie, verifyOwnerTotp, verifyPassword } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { clientIp, rateLimitDurable } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!(await rateLimitDurable(`login:${clientIp(request)}`, 10, 60))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const { password, code } = await request.json().catch(() => ({}));
  const role = await verifyPassword(String(password ?? ""));
  if (!role) {
    await logAudit({ action: "login_failed", role: null });
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Second factor — only the owner can enable 2FA, so only they are challenged.
  if (role === "super" && (await isTotpEnabled())) {
    if (!code) return NextResponse.json({ needsCode: true }); // password OK, ask for the code
    if (!(await verifyOwnerTotp(String(code)))) {
      await logAudit({ action: "login_2fa_failed", role });
      return NextResponse.json({ error: "Invalid authentication code", needsCode: true }, { status: 401 });
    }
  }

  await setAuthCookie(role, hashPassword(String(password ?? "")));
  await logAudit({ action: "login", role });
  return NextResponse.json({ ok: true, role });
}
