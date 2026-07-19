import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { registerUser } from "@/lib/user-auth";
import { checkEmail } from "@/lib/validation";

export async function POST(request: Request) {
  if (!rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));

  const emailCheck = checkEmail(String(body.email ?? ""));
  if (!emailCheck.ok) {
    return NextResponse.json({ error: "email" }, { status: 422 });
  }

  const result = await registerUser({
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    role: body.role === "business" ? "business" : "customer",
    company: body.company ? String(body.company) : undefined,
    trade: body.trade ? String(body.trade) : undefined,
    regions: Array.isArray(body.regions) ? body.regions.map(String) : [],
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.error === "exists" ? 409 : 422 });
  }
  return NextResponse.json({ user: result.user }, { status: 201 });
}
