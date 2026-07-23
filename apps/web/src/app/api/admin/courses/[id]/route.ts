import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteCourse, updateCourse } from "@/lib/courses-store";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const course = await updateCourse(id, body);
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ action: "course_save", role: await getRole(), detail: course.slug });
  return NextResponse.json({ course });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteCourse(id);
  if (ok) await logAudit({ action: "course_delete", role: await getRole(), detail: id });
  return NextResponse.json({ ok });
}
