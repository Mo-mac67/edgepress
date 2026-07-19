import { NextResponse } from "next/server";
import { addAdminUser, getRole, listAdminUsers, removeAdminUser } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";

export async function GET() {
  if ((await getRole()) !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ users: await listAdminUsers() });
}

export async function POST(request: Request) {
  if ((await getRole()) !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { action, label, password, id } = await request.json().catch(() => ({}));

  if (action === "add") {
    if (!(await addAdminUser(String(label ?? ""), String(password ?? "")))) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    await logAudit({ action: "add_admin_user", role: "super", detail: String(label) });
  } else if (action === "remove") {
    if (!(await removeAdminUser(String(id ?? "")))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await logAudit({ action: "remove_admin_user", role: "super" });
  } else {
    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  }

  return NextResponse.json({ users: await listAdminUsers() });
}
