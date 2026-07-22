import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiReady } from "@/lib/ai/engine";
import { optimizeForIntent } from "@/lib/ai/features";

/** Optimize a piece of content for a target search intent. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  const intent = String(body.intent ?? "").trim();
  if (!text || !intent) return NextResponse.json({ error: "Provide content and a target intent" }, { status: 422 });
  try {
    return NextResponse.json(await optimizeForIntent(text, intent, String(body.locale ?? "en")));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
