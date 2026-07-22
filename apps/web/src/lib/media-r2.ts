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
  return path.join(dir, "media", key);
}

/** S3-compatible object storage (EDGEPRESS_MEDIA=s3). Loaded lazily so it's
 *  only used when configured. */
function useS3(): boolean {
  return process.env.EDGEPRESS_MEDIA === "s3";
}

export async function putMedia(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (useS3()) {
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
  if (useS3()) {
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
  if (useS3()) {
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
