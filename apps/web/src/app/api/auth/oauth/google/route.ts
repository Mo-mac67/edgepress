import { NextResponse } from "next/server";
import { oauthGoogleEnabled } from "@/lib/oauth";

/** Feature flag for the login UI. */
export async function GET() {
  return NextResponse.json({ enabled: oauthGoogleEnabled() });
}
