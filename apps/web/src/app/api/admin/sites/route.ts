import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { addSite, listSites, refreshAllSites, refreshSite, removeSite, summarize } from "@/lib/sites-store";

export const dynamic = "force-dynamic";

/** The console holds keys to other sites, so owner-only throughout. */
async function ownerOnly() {
  return (await getRole()) === "super";
}

export async function GET() {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const sites = await listSites();
  return NextResponse.json({ sites, summary: summarize(sites) });
}

export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;

  if (body.action === "refresh-all") {
    const sites = await refreshAllSites();
    return NextResponse.json({ sites, summary: summarize(sites) });
  }
  if (body.action === "refresh" && body.id) {
    const site = await refreshSite(body.id);
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ site });
  }

  const result = await addSite({ name: body.name, url: body.url, apiKey: body.apiKey });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  // Log the site, never the key.
  await logAudit({ action: "console_site_add", role: "super", detail: result.url });
  // Report immediately so the row isn't blank on arrival.
  const site = await refreshSite(result.id);
  return NextResponse.json({ site: site ?? result }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const removed = await removeSite(id);
  if (removed) await logAudit({ action: "console_site_remove", role: "super", detail: id });
  return NextResponse.json({ ok: removed });
}
