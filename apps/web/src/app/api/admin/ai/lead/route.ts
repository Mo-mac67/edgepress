import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getLead } from "@/lib/leads-store";
import { draftLeadReply, scoreLead } from "@/lib/ai/features";

/** CRM AI: score a lead, or draft a reply email. action: "score" | "reply". */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const lead = await getLead(String(body.leadId ?? ""));
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const locale = body.locale === "fr" ? "fr" : "en";

  try {
    if (body.action === "reply") {
      const draft = await draftLeadReply(lead as unknown as Record<string, unknown>, String(body.instruction ?? ""), locale);
      return NextResponse.json(draft);
    }
    const score = await scoreLead(lead as unknown as Record<string, unknown>);
    return NextResponse.json(score);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI call failed" }, { status: 502 });
  }
}
