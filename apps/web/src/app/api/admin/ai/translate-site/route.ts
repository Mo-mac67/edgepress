import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady } from "@/lib/ai/engine";
import { translatePage } from "@/lib/ai/features";
import { getActiveLocales, getPages, savePage } from "@/lib/cms-store";

/** Translate every page into the target locale (additive — each page's other
 *  locales are untouched). Best-effort per page so one failure doesn't abort. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const to = String(body.to ?? "");
  const from = String(body.from ?? "en");
  if (!(await getActiveLocales()).includes(to) || from === to) {
    return NextResponse.json({ error: "Invalid target locale" }, { status: 422 });
  }
  const pages = await getPages();
  let translated = 0;
  for (const p of pages) {
    try {
      await savePage(await translatePage(p, from, to));
      translated++;
    } catch {
      /* skip this page, keep going */
    }
  }
  await logAudit({ action: "translate_site", role: await getRole(), detail: `${from}->${to}: ${translated} pages` });
  return NextResponse.json({ ok: true, translated });
}
