import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/admin-auth";
import { addMedia, getMedia } from "@/lib/cms-store";
import { putMedia } from "@/lib/media-r2";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ media: await getMedia() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name);
  const isAudio = !isVideo && (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|oga|aac|flac)$/i.test(file.name));
  const kind = isVideo ? "video" : isAudio ? "audio" : "image";
  // Workers accept request bodies up to ~100MB on the free plan.
  const maxBytes = (isVideo ? 90 : isAudio ? 25 : 8) * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File too large (max ${isVideo ? "90MB for video" : isAudio ? "25MB for audio" : "8MB for images"})` }, { status: 413 });
  }

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = randomUUID().slice(0, 12);
  const key = `${id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await putMedia(key, bytes, file.type || "application/octet-stream");

  const item = {
    id,
    key,
    url: `/api/media/${key}`,
    filename: file.name,
    size: file.size,
    kind: kind as "video" | "image" | "audio",
    uploadedAt: new Date().toISOString(),
  };
  await addMedia(item);
  return NextResponse.json({ item }, { status: 201 });
}
