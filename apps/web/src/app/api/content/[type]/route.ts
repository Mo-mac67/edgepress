import { NextResponse } from "next/server";
import { getContentType, getEntries, getPublishedEntries } from "@/lib/content-store";
import { tokenFromRequest, verifyApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Public Content API. Returns published entries of a content type as JSON.
 * `?status=all` (drafts included) requires a valid API key (Bearer or ?key=).
 * The type's field schema is included so consumers can render generically.
 */
export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type: typeSlug } = await params;
  const type = await getContentType(typeSlug);
  if (!type) return NextResponse.json({ error: "Unknown content type" }, { status: 404, headers: cors });

  const url = new URL(request.url);
  const wantAll = url.searchParams.get("status") === "all";
  if (wantAll && !(await verifyApiKey(tokenFromRequest(request)))) {
    return NextResponse.json({ error: "API key required for drafts" }, { status: 401, headers: cors });
  }

  const all = wantAll ? await getEntries(typeSlug) : await getPublishedEntries(typeSlug);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  // Spread data first so system fields stay authoritative even if a content
  // type defines a field named "status"/"id"/etc.
  const entries = all.slice(0, limit).map(({ id, slug, status, data, createdAt, updatedAt }) => ({ ...data, id, slug, status, createdAt, updatedAt }));

  return NextResponse.json(
    { type: { slug: type.slug, name: type.name, fields: type.fields }, count: entries.length, entries },
    { headers: cors },
  );
}
