import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady, generateImage } from "@/lib/ai/engine";
import { addMedia } from "@/lib/cms-store";
import { putMedia } from "@/lib/media-r2";

/** Generate an image from a prompt (Workers AI flux) and add it to the media
 *  library, using the prompt as its alt text. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Describe the image you want" }, { status: 422 });

  try {
    const bytes = await generateImage(prompt);
    const id = randomUUID().slice(0, 12);
    const key = `${id}.jpg`;
    await putMedia(key, bytes, "image/jpeg");
    const item = {
      id,
      key,
      url: `/api/media/${key}`,
      filename: `ai-${id}.jpg`,
      size: bytes.length,
      kind: "image" as const,
      uploadedAt: new Date().toISOString(),
      alt: prompt.slice(0, 200),
    };
    await addMedia(item);
    await logAudit({ action: "ai_image_generate", role: "admin", detail: prompt.slice(0, 60) });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Image generation failed" }, { status: 500 });
  }
}
