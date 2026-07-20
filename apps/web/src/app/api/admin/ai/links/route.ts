import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiReady } from "@/lib/ai/engine";
import { internalLinkIdeas } from "@/lib/ai/features";
import { getPages } from "@/lib/cms-store";
import { tx } from "@/lib/cms-types";

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Paste some content first" }, { status: 422 });

  const pages = (await getPages())
    .filter((p) => p.status === "published")
    .map((p) => ({ slug: p.slug, title: tx(p.title, "en") || p.slug || "Home" }));

  try {
    const links = await internalLinkIdeas(text, pages);
    return NextResponse.json({ links });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
