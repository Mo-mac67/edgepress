import { NextResponse } from "next/server";
import { getRole, listAdminUsers } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { readJsonDoc, writeJsonDoc } from "@/lib/storage";

/**
 * Per-admin dashboard tab permissions (TASK: super-admin tab control).
 * Stored in the site's admin config KV doc (admin-config.json):
 *   { passwordHash?, tabPermissions?: { [adminUsername]: string[] } }
 * Absent username = all tabs. "admin" = the primary client-admin password;
 * managed admin users are keyed by their label. Super is never restricted.
 * Super-only endpoint.
 */
const CONFIG_FILE = "admin-config.json";

type AdminConfig = { passwordHash?: string; tabPermissions?: Record<string, string[]> };

export async function GET() {
  if ((await getRole()) !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cfg = await readJsonDoc<AdminConfig>(CONFIG_FILE, {});
  const managed = await listAdminUsers();
  return NextResponse.json({
    tabPermissions: cfg.tabPermissions ?? {},
    admins: ["admin", ...managed.map((u) => u.label)],
  });
}

export async function POST(request: Request) {
  if ((await getRole()) !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  if (!username || username === "super") {
    return NextResponse.json({ error: "Bad username" }, { status: 400 });
  }

  const cfg = await readJsonDoc<AdminConfig>(CONFIG_FILE, {});
  const perms = { ...(cfg.tabPermissions ?? {}) };

  if (body.tabs === null) {
    delete perms[username]; // back to "all tabs"
  } else if (Array.isArray(body.tabs)) {
    perms[username] = (body.tabs as unknown[]).map((t) => String(t).slice(0, 32)).slice(0, 32);
  } else {
    return NextResponse.json({ error: "Bad tabs" }, { status: 400 });
  }

  await writeJsonDoc(CONFIG_FILE, { ...cfg, tabPermissions: perms });
  await logAudit({ action: "set_tab_permissions", role: "super", detail: username });
  return NextResponse.json({ tabPermissions: perms });
}
