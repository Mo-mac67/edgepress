import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiReady } from "@/lib/ai/engine";
import { titleIdeas } from "@/lib/ai/features";

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiReady())) return NextResponse.json({ error: "AI is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic ?? "").trim();
  if (!topic) return NextResponse.json({ error: "Enter a topic" }, { status: 422 });
  const titles = await titleIdeas(topic, body.locale === "fr" ? "fr" : "en");
  return NextResponse.json({ titles });
}
