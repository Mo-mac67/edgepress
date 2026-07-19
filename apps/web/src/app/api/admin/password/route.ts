import { NextResponse } from "next/server";
import { getRole, hashPassword, setAdminPassword, setAuthCookie, verifyPassword } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";

export async function POST(request: Request) {
  const role = await getRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { current, next } = await request.json().catch(() => ({}));

  // Super-admin can reset the client password without knowing the current one.
  if (role !== "super") {
    if ((await verifyPassword(String(current ?? ""))) !== "admin") {
      return NextResponse.json({ error: "Bad current password" }, { status: 400 });
    }
  }

  if (!(await setAdminPassword(String(next ?? "")))) {
    return NextResponse.json({ error: "Invalid new password" }, { status: 400 });
  }

  if (role === "admin") await setAuthCookie("admin", hashPassword(String(next)));
  await logAudit({ action: role === "super" ? "reset_admin_password" : "change_password", role });

  return NextResponse.json({ ok: true });
}
