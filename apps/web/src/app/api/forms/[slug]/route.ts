import { NextResponse } from "next/server";
import { addSubmission, getForm, validateSubmission } from "@/lib/forms-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { dispatchWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** Public form submission. Rate-limited, honeypot-protected, schema-validated. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!rateLimit(`form:${slug}:${clientIp(request)}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: cors });
  }
  const form = await getForm(slug);
  if (!form) return NextResponse.json({ error: "Unknown form" }, { status: 404, headers: cors });

  const body = await request.json().catch(() => ({}));
  // Honeypot: hidden "_hp" field filled → pretend success, store nothing.
  if (body._hp) return NextResponse.json({ ok: true }, { headers: cors });

  const result = validateSubmission(form, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422, headers: cors });

  const sub = await addSubmission(slug, result.data);
  await dispatchWebhook("form.submitted", { form: slug, submission: sub });
  return NextResponse.json({ ok: true, message: form.successMessage }, { status: 201, headers: cors });
}
