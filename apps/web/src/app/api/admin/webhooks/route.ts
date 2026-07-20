import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { addWebhook, listWebhooks, removeWebhook, testWebhook, WEBHOOK_EVENTS } from "@/lib/webhooks";

async function ownerOnly() {
  return (await getRole()) === "super";
}

export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  return NextResponse.json({ webhooks: await listWebhooks(), events: WEBHOOK_EVENTS });
}

export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "remove") {
    const ok = await removeWebhook(String(body.id ?? ""));
    if (ok) await logAudit({ action: "webhook_remove", role: "super", detail: String(body.id) });
    return NextResponse.json({ ok });
  }
  if (body.action === "test") {
    return NextResponse.json(await testWebhook(String(body.id ?? "")));
  }
  const result = await addWebhook(String(body.url ?? ""), Array.isArray(body.events) ? body.events : []);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "webhook_add", role: "super", detail: result.url });
  return NextResponse.json({ webhook: result }, { status: 201 });
}
