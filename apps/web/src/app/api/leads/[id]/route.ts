import { NextResponse } from "next/server";
import { getRole, isAuthed } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { deleteLead, LEAD_STATUSES, updateLead } from "@/lib/leads-store";
import type { LeadStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: { status?: LeadStatus; notes?: string } = {};
  if (body.status && LEAD_STATUSES.includes(body.status)) {
    patch.status = body.status as LeadStatus;
  }
  if (typeof body.notes === "string") {
    patch.notes = body.notes;
  }

  const lead = await updateLead(id, patch);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteLead(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ action: "delete_lead", role });
  return NextResponse.json({ ok: true });
}
