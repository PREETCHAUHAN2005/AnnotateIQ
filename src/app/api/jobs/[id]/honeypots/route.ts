import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/honeypots — honeypot units with gold vs predicted comparison
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const units = await db.unit.findMany({
    where: { jobId: id, isHoneypot: true },
    orderBy: { seq: "asc" },
    include: { final: true },
  });

  const result = units.map((u) => {
    const gold = u.goldPayload ? JSON.parse(u.goldPayload) : null;
    const predicted = u.final ? JSON.parse(u.final.payload) : null;
    const events = u.qualityEvents
      ? undefined
      : undefined;
    return {
      unitId: u.id,
      seq: u.seq,
      stem: u.stem,
      isHoneypot: u.isHoneypot,
      gold,
      predicted,
      confidence: u.final?.confidence ?? null,
      route: u.final?.route ?? null,
      reviewerAction: u.final?.reviewerAction ?? null,
    };
  });

  // get quality events for honeypot pass/fail
  const events = await db.qualityEvent.findMany({
    where: { jobId: id, kind: { in: ["honeypot_pass", "honeypot_fail"] } },
  });
  const eventMap: Record<string, { kind: string; detail: string | null }> = {};
  for (const e of events) {
    eventMap[e.unitId] = { kind: e.kind, detail: e.detail };
  }

  const enriched = result.map((r) => ({
    ...r,
    event: eventMap[r.unitId] ?? null,
    // field-level diff
    diffs: goldPredictedDiff(r.gold, r.predicted),
  }));

  return NextResponse.json({ honeypots: enriched, total: enriched.length });
}

function goldPredictedDiff(gold: Record<string, unknown> | null, predicted: Record<string, unknown> | null) {
  if (!gold || !predicted) return [];
  const fields = ["risk_label", "recommended_action"];
  if (gold.risk_cluster_id) fields.push("risk_cluster_id");
  if (gold.failure_reason) fields.push("failure_reason");
  if (gold.retryability) fields.push("retryability");
  return fields.map((f) => ({
    field: f,
    gold: String(gold[f] ?? ""),
    predicted: String(predicted[f] ?? ""),
    match: String(gold[f] ?? "").toLowerCase() === String(predicted[f] ?? "").toLowerCase(),
  }));
}
