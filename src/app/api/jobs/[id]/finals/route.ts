import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/finals — all merged final annotations for a job
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const finals = await db.final.findMany({
    where: { jobId: id },
    include: { unit: true },
    orderBy: { unit: { seq: "asc" } },
  });
  return NextResponse.json({
    finals: finals.map((f) => ({
      id: f.id,
      unitId: f.unitId,
      seq: f.unit.seq,
      isHoneypot: f.unit.isHoneypot,
      payload: JSON.parse(f.payload),
      confidence: f.confidence,
      agreement: f.agreement,
      route: f.route,
      reviewedBy: f.reviewedBy,
      reviewerAction: f.reviewerAction,
      reviewNote: f.reviewNote,
    })),
  });
}
