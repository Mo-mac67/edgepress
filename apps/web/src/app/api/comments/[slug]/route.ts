import { NextResponse } from "next/server";
import { addComment, getApprovedComments } from "@/lib/comments-store";
import { getPost, getSettings } from "@/lib/cms-store";
import { isLive } from "@/lib/cms-types";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSpam } from "@/lib/spam";

export const dynamic = "force-dynamic";

/** Approved comments for a post (public, oldest first). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`commentsq:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ comments: [] }, { status: 429 });
  }
  const { slug } = await params;
  const comments = (await getApprovedComments(slug)).map(({ author, body, createdAt }) => ({ author, body, createdAt }));
  return NextResponse.json({ comments });
}

/** Submit a comment — always lands in the moderation queue, never live. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!rateLimit(`comment:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many comments — try again in a minute" }, { status: 429 });
  }
  const settings = await getSettings();
  if (settings.commentsEnabled === false) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });
  const post = await getPost(slug);
  if (!post || !isLive(post)) return NextResponse.json({ error: "Unknown post" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (body._hp) return NextResponse.json({ ok: true, pending: true }); // honeypot: pretend success
  const spam = isSpam(`${body.author ?? ""} ${body.body ?? ""}`);
  const result = await addComment({ postSlug: slug, author: body.author, body: body.body, spam });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, pending: true }, { status: 201 });
}
