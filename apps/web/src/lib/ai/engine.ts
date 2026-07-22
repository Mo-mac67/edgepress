import "server-only";
import { readJsonDoc, writeJsonDoc } from "@/lib/storage";
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, type AIConfig, type AIFeature, type AIProviderId } from "./types";

const AI_CONFIG_KEY = "cms-ai.json";
const AI_USAGE_KEY = "cms-ai-usage.json";

// ─── Config ─────────────────────────────────────────────
export async function getAIConfig(): Promise<AIConfig> {
  const c = await readJsonDoc<AIConfig | null>(AI_CONFIG_KEY, null);
  if (!c) return DEFAULT_AI_CONFIG;
  return { ...DEFAULT_AI_CONFIG, ...c, keys: { ...DEFAULT_AI_CONFIG.keys, ...c.keys }, routing: c.routing ?? {} };
}
export async function saveAIConfig(c: AIConfig): Promise<void> {
  await writeJsonDoc(AI_CONFIG_KEY, c);
}

// ─── Usage metering ─────────────────────────────────────
export interface UsageRow {
  feature: string;
  provider: string;
  calls: number;
  inTokens: number;
  outTokens: number;
}
export async function getUsage(): Promise<UsageRow[]> {
  return readJsonDoc<UsageRow[]>(AI_USAGE_KEY, []);
}
async function recordUsage(feature: string, provider: string, inTokens: number, outTokens: number): Promise<void> {
  try {
    const rows = await readJsonDoc<UsageRow[]>(AI_USAGE_KEY, []);
    const row = rows.find((r) => r.feature === feature && r.provider === provider);
    if (row) {
      row.calls += 1;
      row.inTokens += inTokens;
      row.outTokens += outTokens;
    } else rows.push({ feature, provider, calls: 1, inTokens, outTokens });
    await writeJsonDoc(AI_USAGE_KEY, rows);
  } catch {
    /* metering is best-effort */
  }
}

// ─── Provider calls ─────────────────────────────────────
export interface AIRequest {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /** Ask for strict JSON back. */
  json?: boolean;
  temperature?: number;
}
export interface AIResult {
  text: string;
  inTokens: number;
  outTokens: number;
}

async function workersAiEnv(): Promise<{ run: (model: string, input: unknown) => Promise<unknown> } | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const env = mod.getCloudflareContext().env as Record<string, unknown> | undefined;
    return (env?.AI as { run: (m: string, i: unknown) => Promise<unknown> } | undefined) ?? null;
  } catch {
    return null;
  }
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);

async function callProvider(provider: AIProviderId, model: string, cfg: AIConfig, req: AIRequest): Promise<AIResult> {
  const maxTokens = req.maxTokens ?? 1200;
  const sys = req.system ?? "You are a helpful assistant.";
  const messages = [
    ...(sys ? [{ role: "system" as const, content: sys }] : []),
    { role: "user" as const, content: req.prompt },
  ];

  if (provider === "workers-ai") {
    const ai = await workersAiEnv();
    if (!ai) throw new Error("Workers AI binding not available in this environment");
    const res = (await ai.run(model, { messages, max_tokens: maxTokens, temperature: req.temperature ?? 0.7 })) as { response?: unknown };
    // Some models return `response` as an already-parsed object for JSON prompts.
    const r = res.response;
    const text = typeof r === "string" ? r : r == null ? "" : JSON.stringify(r);
    return { text, inTokens: approxTokens(sys + req.prompt), outTokens: approxTokens(text) };
  }

  if (provider === "anthropic") {
    if (!cfg.keys.anthropic) throw new Error("Anthropic API key not set");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cfg.keys.anthropic, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: "user", content: req.prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    return { text, inTokens: data.usage?.input_tokens ?? approxTokens(sys + req.prompt), outTokens: data.usage?.output_tokens ?? approxTokens(text) };
  }

  if (provider === "openai") {
    if (!cfg.keys.openai) throw new Error("OpenAI API key not set");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.keys.openai}`, "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages, ...(req.json ? { response_format: { type: "json_object" } } : {}) }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, inTokens: data.usage?.prompt_tokens ?? approxTokens(sys + req.prompt), outTokens: data.usage?.completion_tokens ?? approxTokens(text) };
  }

  if (provider === "google") {
    if (!cfg.keys.google) throw new Error("Google AI key not set");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.keys.google}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: req.prompt }] }], generationConfig: { maxOutputTokens: maxTokens, ...(req.json ? { responseMimeType: "application/json" } : {}) } }),
    });
    if (!res.ok) throw new Error(`Google error ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text, inTokens: data.usageMetadata?.promptTokenCount ?? approxTokens(sys + req.prompt), outTokens: data.usageMetadata?.candidatesTokenCount ?? approxTokens(text) };
  }

  // ollama
  const res = await fetch(`${cfg.ollamaUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options: { num_predict: maxTokens } }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  const text = data.message?.content ?? "";
  return { text, inTokens: approxTokens(sys + req.prompt), outTokens: approxTokens(text) };
}

/** Resolve the provider + model for a feature, honoring per-feature routing. */
function resolve(cfg: AIConfig, feature: AIFeature): { provider: AIProviderId; model: string } {
  const override = cfg.routing[feature];
  if (override?.provider && override.model) return override;
  const provider = cfg.defaultProvider;
  return { provider, model: AI_PROVIDERS[provider].defaultModel };
}

export class AIDisabledError extends Error {}
export class AIUnavailableError extends Error {}
export class AIBudgetError extends Error {}

/** Total AI calls made so far (across all features/providers). */
export async function totalAiCalls(): Promise<number> {
  return (await getUsage()).reduce((sum, r) => sum + r.calls, 0);
}

/** High-level entry point used by every AI feature. */
export async function aiComplete(feature: AIFeature, req: AIRequest): Promise<AIResult> {
  const cfg = await getAIConfig();
  if (!cfg.enabled) throw new AIDisabledError("AI features are turned off");
  // Safety budget: refuse once the configured call cap is reached.
  if (cfg.callBudget && cfg.callBudget > 0 && (await totalAiCalls()) >= cfg.callBudget) {
    throw new AIBudgetError("AI call budget reached — raise it in the AI settings to continue.");
  }
  const { provider, model } = resolve(cfg, feature);
  const result = await callProvider(provider, model, cfg, req);
  await recordUsage(feature, provider, result.inTokens, result.outTokens);
  return result;
}

/** Vision: describe an image for alt text (Workers AI LLaVA, free, ungated). */
export async function describeImage(bytes: Uint8Array): Promise<string> {
  const ai = await workersAiEnv();
  if (!ai) throw new Error("Workers AI binding not available");
  const res = (await ai.run("@cf/llava-hf/llava-1.5-7b-hf", {
    image: Array.from(bytes),
    prompt: "Write a short, factual alt-text description of this image in one sentence, with no preamble.",
    max_tokens: 100,
  })) as { description?: unknown; response?: unknown };
  const r = res.description ?? res.response;
  const text = typeof r === "string" ? r : r == null ? "" : JSON.stringify(r);
  return text.trim().replace(/^["']|["']$/g, "").slice(0, 200);
}

/** Text-to-image via Workers AI (flux-1-schnell, free). Returns JPEG bytes.
 *  Respects the AI enable flag + call budget and records usage. */
export async function generateImage(prompt: string): Promise<Uint8Array> {
  const cfg = await getAIConfig();
  if (!cfg.enabled) throw new AIDisabledError("AI features are turned off");
  if (cfg.callBudget && cfg.callBudget > 0 && (await totalAiCalls()) >= cfg.callBudget) {
    throw new AIBudgetError("AI call budget reached — raise it in the AI settings to continue.");
  }
  const ai = await workersAiEnv();
  if (!ai) throw new AIUnavailableError("Workers AI binding not available");
  const res = (await ai.run("@cf/black-forest-labs/flux-1-schnell", { prompt: prompt.slice(0, 2000) })) as { image?: string };
  if (!res?.image) throw new Error("No image returned");
  const { Buffer } = await import("node:buffer");
  const bytes = new Uint8Array(Buffer.from(res.image, "base64"));
  await recordUsage("imageGenerate", "workers-ai", 0, 0);
  return bytes;
}

/** Parse a JSON object from a model response that may be fenced or chatty. */
export function extractJson<T = unknown>(raw: string): T {
  const start = raw.indexOf("{");
  const arrStart = raw.indexOf("[");
  const s = arrStart !== -1 && (start === -1 || arrStart < start) ? arrStart : start;
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (s === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(raw.slice(s, end + 1)) as T;
}

/** True if the config can actually run (default provider usable). */
export async function aiReady(): Promise<boolean> {
  const cfg = await getAIConfig();
  if (!cfg.enabled) return false;
  const p = cfg.defaultProvider;
  if (p === "workers-ai") return !!(await workersAiEnv());
  if (p === "anthropic") return !!cfg.keys.anthropic;
  if (p === "openai") return !!cfg.keys.openai;
  if (p === "google") return !!cfg.keys.google;
  return true; // ollama assumed reachable
}
