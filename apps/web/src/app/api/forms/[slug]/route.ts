import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/email";
import { addSubmission, getForm, validateSubmission } from "@/lib/forms-store";
import { putMedia } from "@/lib/media-r2";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSpam } from "@/lib/spam";
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

  // JSON for plain forms; multipart when the form has file fields.
  let body: Record<string, unknown> = {};
  const pendingFiles: { field: string; file: File }[] = [];
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await request.formData().catch(() => null);
    if (!fd) return NextResponse.json({ error: "Invalid form data" }, { status: 400, headers: cors });
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") body[k] = v;
    }
    for (const f of form.fields.filter((x) => x.type === "file")) {
      const v = fd.get(f.key);
      if (v && typeof v !== "string" && v.size > 0) pendingFiles.push({ field: f.key, file: v });
    }
  } else {
    body = await request.json().catch(() => ({}));
  }
  // Honeypot: hidden "_hp" field filled → pretend success, store nothing.
  if (body._hp) return NextResponse.json({ ok: true }, { headers: cors });

  // Validate + store uploads BEFORE schema validation so required file fields
  // see their value. Size/type limits are hard server-side rules.
  const FILE_MAX = 5 * 1024 * 1024;
  const FILE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "pdf"];
  for (const { field, file } of pendingFiles) {
    if (file.size > FILE_MAX) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 422, headers: cors });
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!FILE_EXT.includes(ext)) return NextResponse.json({ error: `File type .${ext} not allowed` }, { status: 422, headers: cors });
    const key = `form-uploads/${slug}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await putMedia(key, new Uint8Array(await file.arrayBuffer()), file.type || "application/octet-stream");
    body[field] = `/api/media/${key}`;
  }

  const result = validateSubmission(form, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422, headers: cors });

  const spam = isSpam(Object.values(result.data).map(String).join(" "));
  const sub = await addSubmission(slug, result.data, spam);
  await dispatchWebhook("form.submitted", { form: slug, submission: sub });
  // Per-form notification email (falls back to LEAD_NOTIFY_TO). Spam skipped.
  const notifyTo = form.notifyEmail || process.env.LEAD_NOTIFY_TO;
  if (notifyTo && !spam) {
    const lines = form.fields.map((f) => `${f.label}: ${String(result.data[f.key] ?? "—")}`);
    await sendNotification(notifyTo, `New "${form.name}" submission`, lines.join("\n"));
  }
  return NextResponse.json({ ok: true, message: form.successMessage }, { status: 201, headers: cors });
}
