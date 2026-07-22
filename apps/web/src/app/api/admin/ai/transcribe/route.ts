import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getMedia, setMediaAlt } from "@/lib/cms-store";
import { getMediaBlob } from "@/lib/media-r2";
import { transcribe } from "@/lib/ai/engine";

/** Transcribe an audio (or video's audio) media item with Whisper; stores the
 *  transcript as the item's caption (alt). */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const item = (await getMedia()).find((m) => m.id === body.id);
  if (!item) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  if (item.kind === "image") return NextResponse.json({ error: "Transcription is for audio/video" }, { status: 422 });

  const blob = await getMediaBlob(item.key);
  if (!blob) return NextResponse.json({ error: "File missing" }, { status: 404 });
  if (blob.bytes.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Too large to transcribe (max ~10MB of audio)" }, { status: 413 });
  }

  try {
    const text = await transcribe(blob.bytes);
    if (text) await setMediaAlt(item.id, text.slice(0, 4000));
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Transcription failed" }, { status: 502 });
  }
}
