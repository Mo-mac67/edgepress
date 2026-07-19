import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { bidCount, createTender, listTenders } from "@/lib/tenders-store";
import { currentUser } from "@/lib/user-auth";

export async function GET() {
  const tenders = await listTenders({ status: "open" });
  const withCounts = await Promise.all(
    tenders.map(async (t) => ({
      id: t.id,
      title: t.title,
      location: t.location,
      category: t.category,
      tags: t.tags,
      totalMin: t.totalMin,
      totalMax: t.totalMax,
      createdAt: t.createdAt,
      bids: await bidCount(t.id),
    })),
  );
  return NextResponse.json({ tenders: withCounts });
}

export async function POST(request: Request) {
  if (!rateLimit(`tender:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "invalid" }, { status: 422 });

  const lines = Array.isArray(body.lines)
    ? body.lines.slice(0, 12).map((l: Record<string, unknown>) => ({
        label: String(l.label ?? "").slice(0, 80),
        detail: String(l.detail ?? "").slice(0, 80),
        min: Number(l.min) || 0,
        max: Number(l.max) || 0,
      }))
    : [];

  const tender = await createTender({
    ownerId: user.id,
    ownerName: user.name,
    title,
    description: String(body.description ?? "").trim().slice(0, 2000),
    location: String(body.location ?? "").trim().slice(0, 80),
    category: ["home", "business", "other"].includes(String(body.category)) ? String(body.category) : "other",
    tags: Array.isArray(body.tags) ? (body.tags as unknown[]).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 10) : [],
    lines,
    totalMin: Number(body.totalMin) || 0,
    totalMax: Number(body.totalMax) || 0,
  });

  await logAudit({ action: "tender_created", role: null, detail: `${user.name}: ${title}` });
  return NextResponse.json({ tender }, { status: 201 });
}
