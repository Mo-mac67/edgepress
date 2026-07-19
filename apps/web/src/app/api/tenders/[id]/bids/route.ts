import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addBid, getTender } from "@/lib/tenders-store";
import { currentUser } from "@/lib/user-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(`bid:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  const tender = await getTender(id);
  if (!tender || tender.status !== "open") {
    return NextResponse.json({ error: "Not open" }, { status: 404 });
  }

  const user = await currentUser();
  if (!user || user.role !== "business") {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  if (!user.business?.verified) {
    return NextResponse.json({ error: "unverified" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }

  const bid = await addBid({
    tenderId: id,
    businessId: user.id,
    company: user.business.company,
    trade: user.business.trade,
    amount: Math.round(amount),
    timelineWeeks: Number(body.timelineWeeks) > 0 ? Math.round(Number(body.timelineWeeks)) : undefined,
    message: String(body.message ?? "").trim().slice(0, 1500),
  });

  await logAudit({ action: "bid_placed", role: null, detail: `${user.business.company} → ${tender.title}` });
  return NextResponse.json({ bid }, { status: 201 });
}
