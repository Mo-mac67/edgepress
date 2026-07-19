import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiComplete } from "@/lib/ai/engine";

/** Quick connectivity test for the configured default provider. */
export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { text } = await aiComplete("copilot", { system: "Reply with exactly: OK", prompt: "Say OK", maxTokens: 20 });
    return NextResponse.json({ ok: true, reply: text.trim().slice(0, 80) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "AI call failed" }, { status: 502 });
  }
}
