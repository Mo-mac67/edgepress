import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resetPasswordWithToken } from "@/lib/user-auth";

export async function POST(request: Request) {
  if (!rateLimit(`ureset:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const user = await resetPasswordWithToken(String(body.token ?? ""), String(body.password ?? ""));
  if (!user) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
