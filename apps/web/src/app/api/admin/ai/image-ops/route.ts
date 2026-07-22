import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { imageOpsReady, runImageOp, type ImageOp } from "@/lib/ai/image-ops";
import { addMedia, getMedia } from "@/lib/cms-store";
import { getMediaBlob, putMedia } from "@/lib/media-r2";

/** BYOK image tools: remove-bg / upscale a library image → saved as a NEW item
 *  (the original is never touched). GET reports whether a key is configured. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ready: await imageOpsReady() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const op = String(body.op ?? "") as ImageOp;
  if (op !== "remove-bg" && op !== "upscale") return NextResponse.json({ error: "Unknown operation" }, { status: 422 });
  if (!(await imageOpsReady())) {
    return NextResponse.json({ error: "Add a Replicate API key in the AI panel to use image tools." }, { status: 400 });
  }

  const item = (await getMedia()).find((m) => m.id === body.id);
  if (!item) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  if (item.kind && item.kind !== "image") return NextResponse.json({ error: "Image tools work on images" }, { status: 422 });

  const blob = await getMediaBlob(item.key);
  if (!blob) return NextResponse.json({ error: "Image file missing" }, { status: 404 });

  try {
    const out = await runImageOp(op, blob.bytes, blob.contentType);
    const id = randomUUID().slice(0, 12);
    const ext = out.contentType.includes("png") ? "png" : "jpg";
    const key = `${id}.${ext}`;
    await putMedia(key, out.bytes, out.contentType);
    const suffix = op === "remove-bg" ? "no-bg" : "upscaled";
    const newItem = {
      id,
      key,
      url: `/api/media/${key}`,
      filename: `${item.filename.replace(/\.[^.]+$/, "")}-${suffix}.${ext}`,
      size: out.bytes.length,
      kind: "image" as const,
      uploadedAt: new Date().toISOString(),
      alt: item.alt,
    };
    await addMedia(newItem);
    await logAudit({ action: `image_${op.replace("-", "_")}`, role: "admin", detail: item.filename });
    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Image operation failed" }, { status: 502 });
  }
}
