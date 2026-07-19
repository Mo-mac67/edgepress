import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { aiComplete, extractJson } from "@/lib/ai/engine";
import { getPages } from "@/lib/cms-store";

/**
 * Admin Copilot — answers questions about the site and proposes concrete
 * actions the admin confirms in the UI (it never executes writes itself).
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const message = String(body.message ?? "").slice(0, 2000).trim();
  const locale = body.locale === "fr" ? "fr" : "en";
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 422 });

  const pages = await getPages();
  const pageList = pages.map((p) => `- "${p.title.en || p.slug || "home"}" (slug: "${p.slug}", ${p.status})`).join("\n");
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const convo = history.map((h: { role: string; content: string }) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

  const system = `You are the EdgePress site assistant inside the admin panel. Help the site owner manage their website.
Current pages:
${pageList || "(none yet)"}

You can PROPOSE one action for the user to confirm. Return ONLY JSON:
{"reply":"a short helpful message","action":null | {"type":"create_page","title":"...","prompt":"what the page should contain"} | {"type":"translate_page","slug":"existing page slug","to":"en|fr"} | {"type":"build_site","description":"business description"}}
Rules:
- Only propose an action when the user clearly asks to create/translate/build something. Otherwise action is null and you just answer.
- Never claim you already did something — the user must confirm the action.
- Keep replies concise and in ${locale === "fr" ? "French" : "English"}.`;

  try {
    const { text } = await aiComplete("copilot", { system, prompt: convo ? `${convo}\nUser: ${message}` : message, json: true, maxTokens: 700 });
    let parsed: { reply?: string; action?: unknown };
    try {
      parsed = extractJson(text);
    } catch {
      parsed = { reply: text.trim(), action: null };
    }
    return NextResponse.json({ reply: parsed.reply || "…", action: parsed.action ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Copilot failed" }, { status: 502 });
  }
}
