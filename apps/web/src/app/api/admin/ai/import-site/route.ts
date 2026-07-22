import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady } from "@/lib/ai/engine";
import { importSiteBatch } from "@/lib/site-import";

/** Whole-site import: one batch per call (the client loops until done: true).
 *  Reads the target site's sitemap.xml and rebuilds each page as a draft. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const locale = String(body.locale ?? "en");
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "Enter the site's URL (e.g. https://example.com)" }, { status: 422 });

  try {
    const progress = await importSiteBatch(url, locale);
    if (progress.imported > 0) {
      await logAudit({ action: "ai_import_site", role: await getRole(), detail: `${new URL(url).origin}: +${progress.imported} (${progress.remaining} left)` });
    }
    return NextResponse.json(progress);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    const status = /sitemap fetch failed/.test(msg) ? 422 : 502;
    return NextResponse.json({ error: /sitemap/.test(msg) ? "Couldn't read that site's sitemap.xml — check the URL." : msg }, { status });
  }
}
