import { getSeo } from "@/lib/cms-store";

/** IndexNow key file (.txt extension required by the protocol validators). */
export async function GET() {
  const seo = await getSeo();
  return new Response(seo.indexNowKey, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
