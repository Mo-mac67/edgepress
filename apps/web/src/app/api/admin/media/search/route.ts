import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiReady, cosine, embed } from "@/lib/ai/engine";
import { getMedia } from "@/lib/cms-store";

/** Semantic media search: embed the query, rank media by cosine over their
 *  stored embeddings; items without an embedding fall back to substring match. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const q = String(body.q ?? "").trim();
  if (!q) return NextResponse.json({ media: await getMedia() });

  const media = await getMedia();
  const withVec = media.filter((m) => Array.isArray(m.embedding) && m.embedding.length);
  const qLower = q.toLowerCase();
  const substr = (m: { alt?: string; filename: string }) => (`${m.alt ?? ""} ${m.filename}`).toLowerCase().includes(qLower);

  // No embeddings yet (or AI off) → plain substring search.
  if (withVec.length === 0 || !(await aiReady())) {
    return NextResponse.json({ media: media.filter(substr), semantic: false });
  }

  try {
    const [qv] = await embed([q]);
    const scored = media.map((m) => ({
      m,
      score: m.embedding?.length ? cosine(qv, m.embedding) : (substr(m) ? 0.6 : 0),
    }));
    const ranked = scored.filter((s) => s.score > 0.55 || substr(s.m)).sort((a, b) => b.score - a.score).slice(0, 60).map((s) => s.m);
    return NextResponse.json({ media: ranked, semantic: true });
  } catch {
    return NextResponse.json({ media: media.filter(substr), semantic: false });
  }
}
