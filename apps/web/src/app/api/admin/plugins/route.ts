import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getPlugins, installPlugin, uninstallPlugin } from "@/lib/plugins-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ plugins: await getPlugins() });
}

/** Install (or re-install/upgrade) a plugin from a manifest JSON. Owner only —
 *  a plugin can register site-wide snippets and an agent skill. */
export async function POST(request: Request) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const manifest = body?.manifest ?? body;
  const result = await installPlugin(manifest);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "plugin_install", role: "super", detail: `${result.id}@${result.version}` });
  return NextResponse.json({ plugin: result }, { status: 201 });
}

export async function DELETE(request: Request) {
  if ((await getRole()) !== "super") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const ok = await uninstallPlugin(id);
  if (ok) await logAudit({ action: "plugin_uninstall", role: "super", detail: id });
  return NextResponse.json({ ok });
}
