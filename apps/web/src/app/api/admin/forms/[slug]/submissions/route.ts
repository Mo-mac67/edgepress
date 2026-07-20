import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { deleteSubmission, getForm, getSubmissions, submissionsToCsv } from "@/lib/forms-store";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const form = await getForm(slug);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const subs = await getSubmissions(slug);

  if (new URL(request.url).searchParams.get("format") === "csv") {
    return new NextResponse(submissionsToCsv(form, subs), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-submissions.csv"`,
      },
    });
  }
  return NextResponse.json({ submissions: subs, fields: form.fields });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 422 });
  return NextResponse.json({ ok: await deleteSubmission(slug, id) });
}
