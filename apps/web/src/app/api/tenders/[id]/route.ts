import { NextResponse } from "next/server";
import { getRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-store";
import { bidsForTender, getTender, setTenderStatus, type TenderStatus } from "@/lib/tenders-store";
import { currentUser } from "@/lib/user-auth";

const STATUSES: TenderStatus[] = ["pending", "open", "awarded", "closed"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tender = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [user, adminRole, bids] = await Promise.all([currentUser(), getRole(), bidsForTender(id)]);
  const isOwner = user?.id === tender.ownerId;
  const isAdmin = adminRole !== null;

  // Sealed bids: full list for owner/admin; businesses see only their own bid.
  const myBid = user?.role === "business" ? (bids.find((b) => b.businessId === user.id) ?? null) : null;

  return NextResponse.json({
    tender,
    bidCount: bids.length,
    bids: isOwner || isAdmin ? bids : undefined,
    myBid,
    isOwner,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tender = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status } = await request.json().catch(() => ({}));
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });

  const [user, adminRole] = await Promise.all([currentUser(), getRole()]);
  const isOwner = user?.id === tender.ownerId;
  // Admin can set any status; the owner may only award or close their project.
  const allowed = adminRole !== null || (isOwner && (status === "awarded" || status === "closed"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await setTenderStatus(id, status);
  await logAudit({ action: `tender_${status}`, role: adminRole, detail: tender.title });
  return NextResponse.json({ ok: true });
}
