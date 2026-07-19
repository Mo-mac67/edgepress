import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { keywordIdeas } from "@/lib/ai/features";

/** SEO keyword & content-gap ideas for a topic. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic ?? "").slice(0, 300).trim();
  if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 422 });
  try {
    return NextResponse.json(await keywordIdeas(topic));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI call failed" }, { status: 502 });
  }
}
