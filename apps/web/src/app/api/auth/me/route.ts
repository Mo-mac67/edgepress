import { NextResponse } from "next/server";
import { currentUser } from "@/lib/user-auth";

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}
