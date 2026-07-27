import { NextResponse } from "next/server";
import { getAdminPath, getClientMode, getOwnerUsername, getRole, logoutEverywhere, setAdminPath, setClientMode, setOwnerUsername } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";

/** Owner-only security settings: admin URL path, owner login username,
 *  client-ready mode, and sign-out-everywhere. */
async function snapshot() {
  return { adminPath: await getAdminPath(), ownerUsername: await getOwnerUsername(), clientMode: await getClientMode() };
}

export async function GET() {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await snapshot());
}

export async function POST(request: Request) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "logout-everywhere") {
    await logoutEverywhere();
    await logAudit({ action: "logout_everywhere", role: "super" });
    return NextResponse.json({ ok: true, loggedOut: true });
  }
  if (typeof body.ownerUsername === "string") {
    await setOwnerUsername(body.ownerUsername);
    await logAudit({ action: "set_owner_username", role: "super" });
  }
  if (typeof body.clientMode === "boolean") {
    await setClientMode(body.clientMode);
    await logAudit({ action: "set_client_mode", role: "super", detail: String(body.clientMode) });
  }
  if (typeof body.adminPath === "string") {
    const res = await setAdminPath(body.adminPath);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    await logAudit({ action: "set_admin_path", role: "super", detail: res.path });
    return NextResponse.json({ ok: true, ...(await snapshot()) });
  }
  return NextResponse.json({ ok: true, ...(await snapshot()) });
}
