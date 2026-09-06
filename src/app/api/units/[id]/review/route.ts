import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { UnitAnnotation } from "@/lib/schemas";
import { asRecord, enforceRateLimit, RATE_REVIEW, readJsonBody } from "@/lib/http-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTE = 2000;
const MAX_REVIEWER = 80;

// POST /api/units/[id]/review — human reviewer action on a final record.
// body: { action: "accept"|"edit"|"reject", editedPayload?: UnitAnnotation, note?: string, reviewer?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, "review", RATE_REVIEW);
  if (limited) return limited;

  const { id } = await ctx.params;
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = asRecord(parsedBody.body);

  const action = body.action;
  if (action !== "accept" && action !== "edit" && action !== "reject") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const final = await db.final.findUnique({ where: { unitId: id } });
  if (!final) return NextResponse.json({ error: "final not found" }, { status: 404 });

  const alreadyReviewed = !!final.reviewerAction;

  let payload = final.payload;
  let route = final.route;
  let confidence = final.confidence;

  if (action === "edit") {
    const parsed = UnitAnnotation.safeParse(body.editedPayload);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid editedPayload" }, { status: 400 });
    }
    const edited = parsed.data;
    edited.confidence = 1.0;
    edited.route = "auto";
    payload = JSON.stringify(edited);
    route = "auto";
    confidence = 1.0;
  } else if (action === "accept") {
    try {
      const p = UnitAnnotation.parse(JSON.parse(payload));
      p.confidence = Math.max(p.confidence ?? 0, 0.85);
      p.route = "auto";
      payload = JSON.stringify(p);
    } catch {
      /* keep original payload */
    }
    route = "auto";
    confidence = Math.max(final.confidence, 0.85);
  }

  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null;
  const reviewer =
    typeof body.reviewer === "string" && body.reviewer.trim()
      ? body.reviewer.trim().slice(0, MAX_REVIEWER)
      : "reviewer";

  const updated = await db.final.update({
    where: { unitId: id },
    data: {
      reviewerAction: action,
      reviewNote: note,
      reviewedBy: reviewer,
      payload,
      route,
      confidence,
    },
  });

  await db.unit.update({
    where: { id },
    data: { status: "reviewed" },
  });

  if (!alreadyReviewed) {
    await db.job.update({
      where: { id: final.jobId },
      data: { reviewedCount: { increment: 1 } },
    });
  }

  // Job is done when no human-route finals remain without a reviewer action
  const pendingHuman = await db.final.count({
    where: {
      jobId: final.jobId,
      route: "human",
      reviewerAction: null,
    },
  });
  if (pendingHuman === 0) {
    const finals = await db.final.findMany({ where: { jobId: final.jobId } });
    const auto = finals.filter(
      (f) => f.route === "auto" || f.reviewerAction === "accept" || f.reviewerAction === "edit"
    ).length;
    const human = finals.length - auto;
    await db.job.update({
      where: { id: final.jobId },
      data: { status: "done", autoCount: auto, humanCount: human },
    });
  }

  return NextResponse.json({ ok: true, final: updated });
}
