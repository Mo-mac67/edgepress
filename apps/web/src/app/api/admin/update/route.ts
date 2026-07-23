import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { checkForUpdate } from "@/lib/update-check";

/** Daily-cached update check against the upstream repo's latest release. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await checkForUpdate());
}
