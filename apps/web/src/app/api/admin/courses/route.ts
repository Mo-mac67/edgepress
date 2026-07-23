import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { createCourse, getCourses } from "@/lib/courses-store";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ courses: await getCourses() });
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = await createCourse({ title: body.title, slug: body.slug });
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  await logAudit({ action: "course_create", role: await getRole(), detail: result.slug });
  return NextResponse.json({ course: result }, { status: 201 });
}
