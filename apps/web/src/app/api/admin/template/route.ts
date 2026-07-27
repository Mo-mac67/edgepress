import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { exportTemplate, importTemplate } from "@/lib/template-store";

export const dynamic = "force-dynamic";

async function ownerOnly() {
  return (await getRole()) === "super";
}

/** Download this site's design + structure as a reusable template (no contact
 *  info, leads, or secrets). */
export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const tpl = await exportTemplate();
  await logAudit({ action: "template_export", role: "super", detail: `${tpl.pages.length} pages` });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(tpl, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="edgepress-template-${stamp}.json"`,
    },
  });
}

/** Apply an uploaded template to this site (theme, nav, brand settings, pages). */
export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await request.json().catch(() => null);
  try {
    const { pages } = await importTemplate(body);
    await logAudit({ action: "template_import", role: "super", detail: `${pages} pages` });
    return NextResponse.json({ ok: true, pages });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 422 });
  }
}
