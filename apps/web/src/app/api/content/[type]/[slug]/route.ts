import { NextResponse } from "next/server";
import { getContentType, getEntry } from "@/lib/content-store";
import { tokenFromRequest, verifyApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** Single entry by slug (or id). Draft entries require a valid API key. */
export async function GET(request: Request, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type: typeSlug, slug } = await params;
  const type = await getContentType(typeSlug);
  if (!type) return NextResponse.json({ error: "Unknown content type" }, { status: 404, headers: cors });

  const entry = await getEntry(typeSlug, slug);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404, headers: cors });

  if (entry.status !== "published" && !(await verifyApiKey(tokenFromRequest(request)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: cors });
  }

  const { id, status, data, createdAt, updatedAt } = entry;
  return NextResponse.json({ entry: { id, slug: entry.slug, status, ...data, createdAt, updatedAt } }, { headers: cors });
}
