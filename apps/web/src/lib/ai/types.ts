/**
 * AI layer — shared types (no "server-only" so the admin config UI can import).
 * EdgePress is provider-agnostic + BYOK: it ships with Cloudflare Workers AI as
 * the free default, and users may add their own Anthropic/OpenAI/Google keys.
 */
export type AIProviderId = "workers-ai" | "anthropic" | "openai" | "google" | "ollama";

/** Every distinct AI capability, so models can be routed per feature. */
export type AIFeature =
  | "pageGenerate"
  | "articleWrite"
  | "rewrite"
  | "translate"
  | "seoMeta"
  | "seoKeywords"
  | "altText"
  | "copilot"
  | "leadReply"
  | "siteBuilder"
  | "assistant";

export interface ProviderMeta {
  id: AIProviderId;
  label: string;
  /** Needs a user-supplied API key. */
  byok: boolean;
  /** Default chat model id for this provider. */
  defaultModel: string;
  /** A few suggested models for the UI dropdowns. */
  models: string[];
  hint: string;
}

export const AI_PROVIDERS: Record<AIProviderId, ProviderMeta> = {
  "workers-ai": {
    id: "workers-ai",
    label: "Cloudflare Workers AI (free)",
    byok: false,
    defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    models: [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-4-scout-17b-16e-instruct",
      "@cf/mistralai/mistral-small-3.1-24b-instruct",
      "@cf/qwen/qwen3-30b-a3b-fp8",
      "@cf/meta/llama-3.2-3b-instruct",
    ],
    hint: "Runs on Cloudflare's edge with no API key — the zero-cost default.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    byok: true,
    defaultModel: "claude-haiku-4-5-20251001",
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5", "claude-opus-4-1"],
    hint: "Best quality for long-form content and reasoning. Bring your own key.",
  },
  openai: {
    id: "openai",
    label: "OpenAI (GPT)",
    byok: true,
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    hint: "Bring your own OpenAI API key.",
  },
  google: {
    id: "google",
    label: "Google (Gemini)",
    byok: true,
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
    hint: "Bring your own Google AI Studio key.",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local / self-hosted)",
    byok: false,
    defaultModel: "llama3.1",
    models: ["llama3.1", "mistral", "qwen2.5"],
    hint: "Point at your own Ollama server URL — fully private, no cloud.",
  },
};

export const AI_FEATURE_LABELS: Record<AIFeature, string> = {
  pageGenerate: "Generate page from prompt",
  articleWrite: "Write blog article",
  rewrite: "Rewrite / tone / expand",
  translate: "Translate content",
  seoMeta: "SEO title & description",
  seoKeywords: "Keyword ideas",
  altText: "Image alt text",
  copilot: "Admin copilot",
  leadReply: "Draft lead reply",
  siteBuilder: "AI site builder",
  assistant: "Visitor assistant",
};

export interface AIConfig {
  enabled: boolean;
  defaultProvider: AIProviderId;
  /** BYOK keys (stored in KV; never sent to the browser after saving). */
  keys: { anthropic: string; openai: string; google: string };
  ollamaUrl: string;
  /** Optional per-feature provider+model overrides. */
  routing: Partial<Record<AIFeature, { provider: AIProviderId; model: string }>>;
  /** AI-generated content always lands as a draft — never auto-published. */
  approveFirst: boolean;
  brandVoice: string;
  /** Public visitor assistant chat widget on the live site. */
  assistantEnabled: boolean;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  defaultProvider: "workers-ai",
  keys: { anthropic: "", openai: "", google: "" },
  ollamaUrl: "http://localhost:11434",
  routing: {},
  approveFirst: true,
  brandVoice: "",
  assistantEnabled: false,
};

/** Which providers are usable given the current config (key present / free). */
export function availableProviders(cfg: AIConfig): AIProviderId[] {
  const out: AIProviderId[] = ["workers-ai", "ollama"];
  if (cfg.keys.anthropic) out.push("anthropic");
  if (cfg.keys.openai) out.push("openai");
  if (cfg.keys.google) out.push("google");
  return out;
}
