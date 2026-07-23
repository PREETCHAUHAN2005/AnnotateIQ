import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { UnitAnnotation } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/units/[id]/review — human reviewer action on a final record.
// body: { action: "accept"|"edit"|"reject", editedPayload?: UnitAnnotation, note?: string, reviewer?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "accept" | "edit" | "reject" | undefined;
  if (!action || !["accept", "edit", "reject"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const final = await db.final.findUnique({ where: { unitId: id } });
  if (!final) return NextResponse.json({ error: "final not found" }, { status: 404 });

  let payload = final.payload;
  if (action === "edit" && body.editedPayload) {
    // validate shape loosely; trust the reviewer's edit
    const edited = body.editedPayload as UnitAnnotation;
    edited.confidence = 1.0; // human-reviewed = perfect confidence
    edited.route = "auto"; // promote to auto once accepted
    payload = JSON.stringify(edited);
  }

  const updated = await db.final.update({
    where: { unitId: id },
    data: {
      reviewerAction: action,
      reviewNote: body.note ? String(body.note) : null,
      reviewedBy: body.reviewer ? String(body.reviewer) : "reviewer",
      payload,
    },
  });

  // bump job reviewedCount
  await db.job.update({
    where: { id: final.jobId },
    data: { reviewedCount: { increment: 1 } },
  });

  return NextResponse.json({ ok: true, final: updated });
}
