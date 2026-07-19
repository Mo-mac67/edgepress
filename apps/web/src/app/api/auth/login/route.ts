import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loginUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  if (!rateLimit(`ulogin:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const { email, password } = await request.json().catch(() => ({}));
  const user = await loginUser(String(email ?? ""), String(password ?? ""));
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  return NextResponse.json({ user });
}
