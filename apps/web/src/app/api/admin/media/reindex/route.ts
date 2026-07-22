import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiReady, embed } from "@/lib/ai/engine";
import { getMedia, setMediaEmbeddings } from "@/lib/cms-store";

/** Build the semantic search index: embed every media item that doesn't have an
 *  embedding yet, in one batched AI call (Workers-subrequest-safe). */
export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });

  const media = await getMedia();
  const todo = media.filter((m) => !(Array.isArray(m.embedding) && m.embedding.length)).slice(0, 100);
  if (todo.length === 0) return NextResponse.json({ ok: true, indexed: 0 });

  try {
    const vectors = await embed(todo.map((m) => `${m.alt ?? ""} ${m.filename}`.trim()));
    const map: Record<string, number[]> = {};
    todo.forEach((m, i) => { if (vectors[i]) map[m.id] = vectors[i]; });
    await setMediaEmbeddings(map);
    return NextResponse.json({ ok: true, indexed: Object.keys(map).length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Reindex failed" }, { status: 500 });
  }
}
