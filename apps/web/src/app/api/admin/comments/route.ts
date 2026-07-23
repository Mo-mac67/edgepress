import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { getAllComments } from "@/lib/comments-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ comments: await getAllComments() });
}
