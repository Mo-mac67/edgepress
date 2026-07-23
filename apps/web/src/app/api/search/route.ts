import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { searchContent } from "@/lib/search";

/** Public site search over live pages and posts. GET /api/search?q=…&lang=en */
export async function GET(request: Request) {
  if (!rateLimit(`search:${clientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many searches — try again in a minute" }, { status: 429 });
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const lang = url.searchParams.get("lang") === "fr" ? "fr" : url.searchParams.get("lang") || "en";
  if (q.trim().length < 2) return NextResponse.json({ error: "Query too short" }, { status: 400 });
  const results = await searchContent(q, lang);
  return NextResponse.json({ query: q, results });
}
