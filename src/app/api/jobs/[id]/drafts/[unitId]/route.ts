import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// GET /api/jobs/[id]/drafts/[unitId] — every per-agent draft for a unit.
// Powers the "why did the agents disagree" panel (the demo differentiator).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; unitId: string }> }) {
  const { id, unitId } = await ctx.params;
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.jobId !== id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const drafts = await db.draft.findMany({
    where: { unitId },
    orderBy: [{ attempt: "asc" }, { agent: "asc" }, { sampleIdx: "asc" }],
  });
  const final = await db.final.findUnique({ where: { unitId } });

  return NextResponse.json({
    unit: {
      id: unit.id,
      seq: unit.seq,
      stem: unit.stem,
      options: unit.optionsJson ? safeJson(unit.optionsJson) : null,
      isHoneypot: unit.isHoneypot,
      attempt: unit.attempt,
    },
    drafts: drafts.map((d) => ({
      id: d.id,
      agent: d.agent,
      sampleIdx: d.sampleIdx,
      attempt: d.attempt,
      payload: safeJson(d.payload),
      latencyMs: d.latencyMs,
      createdAt: d.createdAt,
    })),
    final: final
      ? {
          payload: safeJson(final.payload),
          confidence: final.confidence,
          agreement: final.agreement,
          route: final.route,
          reviewedBy: final.reviewedBy,
          reviewerAction: final.reviewerAction,
        }
      : null,
  });
}
