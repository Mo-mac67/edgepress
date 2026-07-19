import { NextResponse } from "next/server";
import { signOutUser } from "@/lib/user-auth";

export async function POST() {
  await signOutUser();
  return NextResponse.json({ ok: true });
}
