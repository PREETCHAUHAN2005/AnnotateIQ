import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/drafts/[unitId] — every per-agent draft for a unit.
// Powers the "why did the agents disagree" panel (the demo differentiator).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; unitId: string }> }) {
  const { id, unitId } = await ctx.params;
  const drafts = await db.draft.findMany({
    where: { unitId },
    orderBy: [{ attempt: "asc" }, { agent: "asc" }, { sampleIdx: "asc" }],
  });
  const final = await db.final.findUnique({ where: { unitId } });
  const unit = await db.unit.findUnique({ where: { id: unitId } });

  return NextResponse.json({
    unit: unit
      ? {
          id: unit.id,
          seq: unit.seq,
          stem: unit.stem,
          options: unit.optionsJson ? JSON.parse(unit.optionsJson) : null,
          isHoneypot: unit.isHoneypot,
          goldPayload: unit.goldPayload ? JSON.parse(unit.goldPayload) : null,
          attempt: unit.attempt,
        }
      : null,
    drafts: drafts.map((d) => ({
      id: d.id,
      agent: d.agent,
      sampleIdx: d.sampleIdx,
      attempt: d.attempt,
      payload: JSON.parse(d.payload),
      latencyMs: d.latencyMs,
      createdAt: d.createdAt,
    })),
    final: final
      ? {
          payload: JSON.parse(final.payload),
          confidence: final.confidence,
          agreement: final.agreement,
          route: final.route,
          reviewedBy: final.reviewedBy,
          reviewerAction: final.reviewerAction,
        }
      : null,
  });
}
