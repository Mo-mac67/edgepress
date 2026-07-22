import "server-only";
import { getAIConfig } from "./engine";

/**
 * BYOK image operations (background removal, upscaling) via Replicate.
 * These have NO free Workers-AI model, so they're strictly opt-in: the site
 * owner pastes a Replicate API token in the AI panel and pays Replicate
 * per run (typically fractions of a cent). Without a key, the endpoints
 * refuse with a clear message — the core product stays free.
 */

const MODELS = {
  "remove-bg": "851-labs/background-remover",
  upscale: "nightmareai/real-esrgan",
} as const;
export type ImageOp = keyof typeof MODELS;

export async function imageOpsReady(): Promise<boolean> {
  return !!(await getAIConfig()).keys.replicate;
}

/** Run one image op on Replicate (synchronous Prefer:wait flow) and return the
 *  resulting image bytes + content type. */
export async function runImageOp(op: ImageOp, bytes: Uint8Array, contentType: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const key = (await getAIConfig()).keys.replicate;
  if (!key) throw new Error("Add a Replicate API key in the AI panel to use image tools.");

  const { Buffer } = await import("node:buffer");
  const dataUri = `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  const input = op === "upscale" ? { image: dataUri, scale: 2 } : { image: dataUri };

  const res = await fetch(`https://api.replicate.com/v1/models/${MODELS[op]}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "wait" },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = (await res.json()) as { status?: string; output?: unknown; error?: string; detail?: string };
  if (!res.ok || data.error) throw new Error(data.error || data.detail || `Replicate error (${res.status})`);
  if (data.status !== "succeeded" || !data.output) throw new Error(`Image op ${data.status ?? "failed"}`);

  const url = Array.isArray(data.output) ? String(data.output[0]) : String(data.output);
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error("Couldn't download the processed image");
  return {
    bytes: new Uint8Array(await img.arrayBuffer()),
    contentType: img.headers.get("content-type") ?? "image/png",
  };
}
