import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/review — the human review queue (units routed to human,
// optionally filtered by unreviewed). Returns everything the review UI needs.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const onlyUnreviewed = req.nextUrl.searchParams.get("unreviewed") === "1";

  const finals = await db.final.findMany({
    where: { jobId: id, route: "human" },
    include: { unit: true },
    orderBy: { unit: { seq: "asc" } },
  });

  const filtered = onlyUnreviewed
    ? finals.filter((f) => !f.reviewerAction)
    : finals;

  return NextResponse.json({
    queue: filtered.map((f) => ({
      id: f.id,
      unitId: f.unitId,
      seq: f.unit.seq,
      stem: f.unit.stem,
      options: f.unit.optionsJson ? JSON.parse(f.unit.optionsJson) : null,
      isHoneypot: f.unit.isHoneypot,
      payload: JSON.parse(f.payload),
      confidence: f.confidence,
      agreement: f.agreement,
      reviewerAction: f.reviewerAction,
      reviewNote: f.reviewNote,
    })),
    total: finals.length,
    reviewed: finals.filter((f) => f.reviewerAction).length,
  });
}
