import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { createEntriesBatch, getContentType } from "@/lib/content-store";
import { parseCsvObjects } from "@/lib/csv";

/** Bulk-create entries from a CSV. Columns match field keys or labels
 *  (case-insensitive); a "slug"/"status" column is honored if present. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const type = await getContentType(slug);
  if (!type) return NextResponse.json({ error: "Unknown content type" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const rows = parseCsvObjects(String(body.csv ?? ""));
  if (rows.length === 0) return NextResponse.json({ error: "No rows found in CSV" }, { status: 422 });
  if (rows.length > 2000) return NextResponse.json({ error: "Too many rows (max 2000)" }, { status: 422 });

  // Build a lookup from lower-cased header → field.
  const byHeader = new Map<string, (typeof type.fields)[number]>();
  for (const f of type.fields) {
    byHeader.set(f.key.toLowerCase(), f);
    byHeader.set(f.label.toLowerCase(), f);
  }

  const publishAll = body.status === "published";
  const inputs = rows.map((row) => {
    const data: Record<string, unknown> = {};
    let rowSlug: string | undefined;
    let rowStatus: string | undefined;
    for (const [header, raw] of Object.entries(row)) {
      const h = header.trim().toLowerCase();
      if (h === "slug") { rowSlug = raw; continue; }
      if (h === "status") { rowStatus = raw; continue; }
      const field = byHeader.get(h);
      if (!field) continue;
      if (field.type === "number") data[field.key] = raw === "" ? undefined : Number(raw);
      else if (field.type === "boolean") data[field.key] = /^(true|1|yes|y)$/i.test(raw.trim());
      else data[field.key] = raw;
    }
    return { slug: rowSlug, status: rowStatus ?? (publishAll ? "published" : "draft"), data };
  });

  const created = await createEntriesBatch(slug, inputs);
  await logAudit({ action: "entries_import", role: await getRole(), detail: `${slug}: ${created} rows` });
  return NextResponse.json({ ok: true, created });
}
