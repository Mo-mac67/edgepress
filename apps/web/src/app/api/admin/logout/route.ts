import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
