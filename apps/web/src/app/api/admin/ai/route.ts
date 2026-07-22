import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { aiReady, getAIConfig, getUsage, saveAIConfig } from "@/lib/ai/engine";
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, type AIConfig } from "@/lib/ai/types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getAIConfig();
  // Never leak raw keys to the browser — send only presence flags.
  const safe = {
    ...cfg,
    keys: { anthropic: cfg.keys.anthropic ? "set" : "", openai: cfg.keys.openai ? "set" : "", google: cfg.keys.google ? "set" : "", replicate: cfg.keys.replicate ? "set" : "" },
  };
  return NextResponse.json({ config: safe, providers: AI_PROVIDERS, ready: await aiReady(), usage: await getUsage() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { config?: Partial<AIConfig> } | null;
  if (!body?.config) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const current = await getAIConfig();
  const incoming = body.config;
  // Keep existing key when the client sends the "set" sentinel (unchanged).
  const mergeKey = (k: "anthropic" | "openai" | "google" | "replicate") => {
    const v = incoming.keys?.[k];
    if (v === undefined || v === "set") return current.keys[k];
    return v;
  };
  const merged: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    ...current,
    ...incoming,
    keys: { anthropic: mergeKey("anthropic"), openai: mergeKey("openai"), google: mergeKey("google"), replicate: mergeKey("replicate") },
    routing: incoming.routing ?? current.routing,
  };
  await saveAIConfig(merged);
  await logAudit({ action: "ai_config_save", role: await getRole(), detail: merged.defaultProvider });
  return NextResponse.json({ ok: true });
}
