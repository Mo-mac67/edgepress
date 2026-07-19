import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { getMcpConfig, saveMcpConfig } from "@/lib/mcp";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getMcpConfig();
  return NextResponse.json({ enabled: cfg.enabled, token: cfg.token, url: `${process.env.SITE_URL ?? ""}/api/mcp` });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const cfg = await getMcpConfig();
  if (typeof body.enabled === "boolean") cfg.enabled = body.enabled;
  if (body.regenerate) cfg.token = `ep_${randomUUID().replace(/-/g, "")}`;
  await saveMcpConfig(cfg);
  await logAudit({ action: "mcp_config", role: await getRole(), detail: cfg.enabled ? "enabled" : "disabled" });
  return NextResponse.json({ enabled: cfg.enabled, token: cfg.token });
}
