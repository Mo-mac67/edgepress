import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";

async function ownerOnly() {
  return (await getRole()) === "super";
}

export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return NextResponse.json({ keys: await listApiKeys() });
}

export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "revoke") {
    const ok = await revokeApiKey(String(body.id ?? ""));
    if (ok) await logAudit({ action: "api_key_revoke", role: "super", detail: String(body.id) });
    return NextResponse.json({ ok });
  }
  const { token, key } = await createApiKey(String(body.label ?? ""));
  await logAudit({ action: "api_key_create", role: "super", detail: key.label });
  // The plaintext token is returned exactly once.
  return NextResponse.json({ token, key }, { status: 201 });
}
