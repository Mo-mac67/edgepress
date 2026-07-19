import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { writeText, type WriteMode } from "@/lib/ai/features";

const MODES: WriteMode[] = ["rewrite", "expand", "shorten", "professional", "friendly", "fix"];

/** Rewrite / tone / expand a single field's text. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mode = (MODES.includes(body.mode) ? body.mode : "rewrite") as WriteMode;
  const text = String(body.text ?? "").slice(0, 6000);
  const locale = body.locale === "fr" ? "fr" : "en";
  if (!text.trim()) return NextResponse.json({ error: "No text" }, { status: 422 });
  try {
    return NextResponse.json({ text: await writeText(mode, text, locale) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI call failed" }, { status: 502 });
  }
}
