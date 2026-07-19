import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getLeads } from "@/lib/leads-store";
import { getEvents } from "@/lib/events-store";
import { computeAnalytics } from "@/lib/analytics";
import { aiComplete } from "@/lib/ai/engine";

/** Natural-language questions over the site's own analytics. */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const question = String(body.question ?? "").slice(0, 400).trim();
  if (!question) return NextResponse.json({ error: "Ask a question" }, { status: 422 });

  const [leads, events] = await Promise.all([getLeads(), getEvents()]);
  const a = computeAnalytics(leads, events, body.days || 30);
  const summary = JSON.stringify({
    kpis: a.kpis,
    topPages: a.topPages.slice(0, 8),
    leadsByCity: a.leadsByCity.slice(0, 8),
    leadsByProjectType: a.leadsByProjectType.slice(0, 8),
    leadsByStatus: a.leadsByStatus,
    leadsByDay: a.leadsByDay.slice(-14),
  });

  try {
    const { text } = await aiComplete("copilot", {
      system: "You are a web analytics assistant. Answer the question using ONLY this JSON analytics data for the site. Be concise, cite the numbers, and note if the data is too sparse to answer. Do not invent metrics that aren't present.\n\nDATA:\n" + summary,
      prompt: question,
      maxTokens: 500,
    });
    return NextResponse.json({ answer: text.trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI call failed" }, { status: 502 });
  }
}
