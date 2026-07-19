import { getSeo } from "@/lib/cms-store";

/** IndexNow key file — proves site ownership to the IndexNow API. */
export async function GET() {
  const seo = await getSeo();
  return new Response(seo.indexNowKey, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
