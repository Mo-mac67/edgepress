import { getMediaBlob } from "@/lib/media-r2";

/** Serves uploaded media (R2 in prod, fs locally) with Range support so video seeking works. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const blob = await getMediaBlob(key.join("/"));
  if (!blob) return new Response("Not found", { status: 404 });

  const total = blob.bytes.byteLength;
  const range = req.headers.get("range");
  const common = {
    "Content-Type": blob.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      if (start <= end && start < total) {
        return new Response(blob.bytes.slice(start, end + 1) as BodyInit, {
          status: 206,
          headers: { ...common, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
        });
      }
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
  }

  return new Response(blob.bytes as BodyInit, { headers: { ...common, "Content-Length": String(total) } });
}
