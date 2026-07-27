import { NextResponse } from "next/server";
import { getAdminPath, getOwnerUsername, getRole, setAdminPath, setOwnerUsername } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";

/** Owner-only security settings: the admin URL path + the owner's login username. */
export async function GET() {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ adminPath: await getAdminPath(), ownerUsername: await getOwnerUsername() });
}

export async function POST(request: Request) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (typeof body.ownerUsername === "string") {
    await setOwnerUsername(body.ownerUsername);
    await logAudit({ action: "set_owner_username", role: "super" });
  }
  if (typeof body.adminPath === "string") {
    const res = await setAdminPath(body.adminPath);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    await logAudit({ action: "set_admin_path", role: "super", detail: res.path });
    return NextResponse.json({ ok: true, adminPath: res.path, ownerUsername: await getOwnerUsername() });
  }
  return NextResponse.json({ ok: true, adminPath: await getAdminPath(), ownerUsername: await getOwnerUsername() });
}
