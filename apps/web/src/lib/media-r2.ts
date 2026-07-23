import "server-only";

/**
 * Media blob storage. On Cloudflare Workers, files live in an R2 bucket
 * (binding MEDIA). Locally they fall back to files under DATA_DIR/media.
 */
type R2Bucket = {
  put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
};

async function bucket(): Promise<R2Bucket | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const env = mod.getCloudflareContext().env as Record<string, unknown> | undefined;
    return (env?.MEDIA as R2Bucket | undefined) ?? null;
  } catch {
    return null;
  }
}

async function localPath(key: string): Promise<string> {
  const path = (await import("node:path")).default;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  // SECURITY: the key comes from the URL — never let it traverse out of the
  // media dir (e.g. "../admin-config.json" would expose the password hash in
  // fs/sqlite mode). Nested keys (form-uploads/<form>/<id>.<ext>) are allowed,
  // but EVERY segment must be a plain filename — no "..", ".", empty, or odd
  // characters — and the resolved path must stay under the media dir.
  const segments = key.split("/");
  if (segments.length > 4 || segments.some((s) => !/^[A-Za-z0-9._-]+$/.test(s) || s === ".." || s === ".")) {
    throw new Error("Invalid media key");
  }
  const mediaDir = path.join(dir, "media");
  const p = path.join(mediaDir, ...segments);
  if (!path.resolve(p).startsWith(path.resolve(mediaDir))) throw new Error("Invalid media key");
  return p;
}

/** S3-compatible object storage (EDGEPRESS_MEDIA=s3). Loaded lazily so it's
 *  only used when configured. */
function s3Enabled(): boolean {
  return process.env.EDGEPRESS_MEDIA === "s3";
}

export async function putMedia(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (s3Enabled()) {
    const { putMediaS3 } = await import("./media-s3");
    return putMediaS3(key, bytes, contentType);
  }
  const b = await bucket();
  if (b) {
    await b.put(key, bytes, { httpMetadata: { contentType } });
    return;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = (await import("node:path")).default;
  const p = await localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, bytes);
  await writeFile(`${p}.type`, contentType, "utf8");
}

export async function getMediaBlob(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (s3Enabled()) {
    const { getMediaS3 } = await import("./media-s3");
    return getMediaS3(key);
  }
  const b = await bucket();
  if (b) {
    const obj = await b.get(key);
    if (!obj) return null;
    return { bytes: new Uint8Array(await obj.arrayBuffer()), contentType: obj.httpMetadata?.contentType ?? "application/octet-stream" };
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const p = await localPath(key);
    const bytes = new Uint8Array(await readFile(p));
    const contentType = await readFile(`${p}.type`, "utf8").catch(() => "application/octet-stream");
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export async function deleteMediaBlob(key: string): Promise<void> {
  if (s3Enabled()) {
    const { deleteMediaS3 } = await import("./media-s3");
    return deleteMediaS3(key);
  }
  const b = await bucket();
  if (b) {
    await b.delete(key);
    return;
  }
  try {
    const { unlink } = await import("node:fs/promises");
    const p = await localPath(key);
    await unlink(p).catch(() => {});
    await unlink(`${p}.type`).catch(() => {});
  } catch {
    /* ignore */
  }
}
