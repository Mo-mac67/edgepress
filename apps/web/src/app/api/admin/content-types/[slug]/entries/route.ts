import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { createEntry, getContentType, getEntries } from "@/lib/content-store";
import { toCsv } from "@/lib/csv";
import { dispatchWebhook } from "@/lib/webhooks";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const entries = await getEntries(slug);

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const type = await getContentType(slug);
    const keys = ["slug", "status", ...(type?.fields.map((f) => f.key) ?? [])];
    const rows = entries.map((e) => ({ slug: e.slug, status: e.status, ...e.data }));
    return new NextResponse(toCsv(keys, rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.csv"` },
    });
  }
  return NextResponse.json({ entries });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const entry = await createEntry(slug, { slug: body.slug, status: body.status, data: body.data });
  if ("error" in entry) return NextResponse.json(entry, { status: 422 });
  await logAudit({ action: "entry_create", role: await getRole(), detail: `${slug}/${entry.slug}` });
  await dispatchWebhook("entry.created", entry);
  if (entry.status === "published") await dispatchWebhook("entry.published", entry);
  return NextResponse.json({ entry }, { status: 201 });
}
