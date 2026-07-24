import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/jobs/[id]/reset — clear all drafts/finals/events for a job so the
// pipeline can be re-run from scratch. Units are preserved but reset to pending.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // delete all finals, drafts, quality events
  await db.final.deleteMany({ where: { jobId: id } });
  await db.qualityEvent.deleteMany({ where: { jobId: id } });
  const units = await db.unit.findMany({ where: { jobId: id }, select: { id: true } });
  const unitIds = units.map((u) => u.id);
  if (unitIds.length > 0) {
    await db.draft.deleteMany({ where: { unitId: { in: unitIds } } });
  }
  // reset units to pending
  await db.unit.updateMany({ where: { jobId: id }, data: { status: "pending", attempt: 0 } });
  await db.job.update({ where: { id }, data: { status: "pending", autoCount: 0, humanCount: 0, reviewedCount: 0 } });

  return NextResponse.json({ ok: true });
}
