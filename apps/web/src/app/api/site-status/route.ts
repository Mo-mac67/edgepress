import { NextResponse } from "next/server";
import { tokenFromRequest, verifyApiKey } from "@/lib/api-keys";
import { APP_VERSION, checkForUpdate } from "@/lib/update-check";
import { getPages, getPosts, getSettings } from "@/lib/cms-store";
import { getLeads } from "@/lib/leads-store";
import { isLive } from "@/lib/cms-types";

export const dynamic = "force-dynamic";

/**
 * What this install can tell a management console about itself.
 *
 * Authenticated with an ordinary API key (Developer → API keys), so bringing a
 * site into a console is the same act as granting Content API access — nothing
 * new to trust, and revoking the key removes the console's access.
 *
 * Deliberately COUNTS ONLY: how many leads, not who they are. A console needs to
 * know a site is alive and whether it needs attention; it doesn't need its
 * customers' contact details, and shipping them would turn one leaked key into
 * a data breach across every site.
 */
export async function GET(request: Request) {
  if (!(await verifyApiKey(tokenFromRequest(request)))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pages, posts, leads, settings] = await Promise.all([getPages(), getPosts(), getLeads(), getSettings()]);
  // Version check is cached upstream; failing it must not fail the whole report.
  const update = await checkForUpdate().catch(() => null);

  const newestLead = leads.reduce<string | null>((newest, l) => {
    const at = l.createdAt ?? null;
    return at && (!newest || at > newest) ? at : newest;
  }, null);

  return NextResponse.json({
    ok: true,
    brandName: settings.brandName,
    version: APP_VERSION,
    latest: update?.latest ?? null,
    updateAvailable: update?.updateAvailable ?? false,
    counts: {
      pages: pages.filter((p) => isLive(p)).length,
      pagesTotal: pages.filter((p) => !p.trashed).length,
      posts: posts.filter((p) => isLive(p)).length,
      postsTotal: posts.filter((p) => !p.trashed).length,
      leads: leads.length,
      newLeads: leads.filter((l) => l.status === "new").length,
    },
    newestLeadAt: newestLead,
    storage: process.env.EDGEPRESS_STORAGE || "kv",
    reportedAt: new Date().toISOString(),
  });
}
