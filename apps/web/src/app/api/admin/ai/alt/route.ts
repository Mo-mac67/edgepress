import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getMedia, setMediaAlt, setMediaEmbedding } from "@/lib/cms-store";
import { getMediaBlob } from "@/lib/media-r2";
import { describeImage, embed } from "@/lib/ai/engine";

/** Smart Media: generate alt text for an uploaded image with a vision model. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const item = (await getMedia()).find((m) => m.id === body.id);
  if (!item) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  if (item.kind === "video") return NextResponse.json({ error: "Alt text is for images" }, { status: 422 });

  const blob = await getMediaBlob(item.key);
  if (!blob) return NextResponse.json({ error: "Image file missing" }, { status: 404 });

  try {
    const alt = await describeImage(blob.bytes);
    await setMediaAlt(item.id, alt);
    // Index it for semantic search (best-effort — never fail the alt request).
    try {
      const [vec] = await embed([`${alt} ${item.filename}`]);
      if (vec) await setMediaEmbedding(item.id, vec);
    } catch {
      /* reindex button can backfill later */
    }
    return NextResponse.json({ alt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Alt generation failed" }, { status: 502 });
  }
}
