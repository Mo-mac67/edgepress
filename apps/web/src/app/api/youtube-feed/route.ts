import { NextResponse } from "next/server";

/**
 * Latest-videos proxy for the youtubeFeed block. YouTube's RSS feed has no
 * CORS headers, so the browser can't fetch it directly — this tiny dynamic
 * route fetches and parses it server-side (regex on a small XML string,
 * negligible CPU) and returns JSON. Cached at the edge for 30 minutes, so a
 * new upload appears on the site within half an hour with NO redeploy.
 */
export const dynamic = "force-dynamic";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

export async function GET(request: Request) {
  const channel = new URL(request.url).searchParams.get("channel") ?? "";
  if (!/^UC[\w-]{16,32}$/.test(channel)) {
    return NextResponse.json({ videos: [] }, { status: 400 });
  }
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EdgePress/1.0)" },
    });
    if (!res.ok) throw new Error(`feed ${res.status}`);
    const xml = await res.text();
    const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .slice(0, 8)
      .map((m) => {
        const e = m[1];
        const pick = (re: RegExp) => e.match(re)?.[1] ?? "";
        const id = pick(/<yt:videoId>([^<]+)</);
        return {
          id,
          title: decode(pick(/<title>([^<]*)</)),
          published: pick(/<published>([^<]+)</),
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${id}`,
        };
      })
      .filter((v) => v.id);
    return NextResponse.json(
      { videos },
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=1800" } },
    );
  } catch {
    // Never break the page over a feed hiccup — the block just hides itself.
    return NextResponse.json({ videos: [] }, { headers: { "Cache-Control": "public, max-age=120" } });
  }
}
