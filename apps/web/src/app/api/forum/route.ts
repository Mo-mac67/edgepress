import { NextResponse } from "next/server";
import { getSettings } from "@/lib/cms-store";
import { addThread } from "@/lib/forum-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSpam } from "@/lib/spam";

export const dynamic = "force-dynamic";

/** Start a topic — always lands in the moderation queue. */
export async function POST(request: Request) {
  if (!rateLimit(`forum:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many posts — try again in a minute" }, { status: 429 });
  }
  if ((await getSettings()).forumEnabled !== true) return NextResponse.json({ error: "The forum is not enabled" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body._hp) return NextResponse.json({ ok: true, pending: true }); // honeypot
  const spam = isSpam(`${body.author ?? ""} ${body.title ?? ""} ${body.body ?? ""}`);
  const result = await addThread({ title: body.title, body: body.body, author: body.author, spam });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, pending: true }, { status: 201 });
}
