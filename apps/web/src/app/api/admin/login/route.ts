import { NextResponse } from "next/server";
import { signIn } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!rateLimit(`login:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const { password } = await request.json().catch(() => ({}));
  const role = await signIn(String(password ?? ""));
  if (!role) {
    await logAudit({ action: "login_failed", role: null });
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  await logAudit({ action: "login", role });
  return NextResponse.json({ ok: true, role });
}
