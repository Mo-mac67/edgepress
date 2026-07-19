import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { submitIndexNow } from "@/lib/seo";

/** Submits all published URLs (or a given list) to IndexNow for instant indexing. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const urls = Array.isArray(body.urls) ? body.urls.map(String) : undefined;
  const result = await submitIndexNow(urls);
  if (result.ok) await logAudit({ action: "seo_indexnow", role: await getRole(), detail: `${result.submitted} URLs` });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
