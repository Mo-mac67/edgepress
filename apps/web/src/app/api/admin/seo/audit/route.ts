import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { auditPages } from "@/lib/seo";

export async function GET(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en";
  return NextResponse.json({ audits: await auditPages(locale) });
}
