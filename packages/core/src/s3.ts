import { createHash, createHmac } from "node:crypto";

/**
 * S3 (and S3-compatible: MinIO, R2's S3 API, Backblaze…) media adapter.
 * Dependency-free AWS SigV4 over fetch — works on Node self-host AND Workers.
 * Enabled with EDGEPRESS_MEDIA=s3 + these env vars:
 *   S3_ENDPOINT (e.g. https://s3.us-east-1.amazonaws.com or your MinIO URL)
 *   S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 * Uses path-style addressing + UNSIGNED-PAYLOAD (broadly compatible).
 */

export function s3Configured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const sha256hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** Derive the SigV4 signing key (exported for test-vector validation). */
export function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function signedFetch(method: string, key: string, body?: Uint8Array, contentType?: string): Promise<Response> {
  const endpoint = process.env.S3_ENDPOINT!.replace(/\/+$/, "");
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKey = process.env.S3_ACCESS_KEY_ID!;
  const secret = process.env.S3_SECRET_ACCESS_KEY!;
  const service = "s3";

  const host = new URL(endpoint).host;
  const canonicalUri = `/${bucket}/${key.split("/").map(enc).join("/")}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = "UNSIGNED-PAYLOAD";

  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join("");

  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(secret, dateStamp, region, service)).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`${endpoint}${canonicalUri}`, {
    method,
    headers: { ...headers, Authorization: authorization },
    body: body ? (body as unknown as BodyInit) : undefined,
  });
}

export async function putMediaS3(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const res = await signedFetch("PUT", key, bytes, contentType);
  if (!res.ok) throw new Error(`S3 put failed: ${res.status}`);
}

export async function getMediaS3(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const res = await signedFetch("GET", key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 get failed: ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
}

export async function deleteMediaS3(key: string): Promise<void> {
  await signedFetch("DELETE", key);
}
