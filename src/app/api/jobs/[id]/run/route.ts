import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (job.status === "labeling" || job.status === "extracting") {
    return NextResponse.json(
      { ok: false, error: "Pipeline already running for this job" },
      { status: 409 }
    );
  }

  // optimistic lock: only one run if status was not already labeling
  const locked = await db.job.updateMany({
    where: { id, status: { notIn: ["labeling", "extracting"] } },
    data: { status: "labeling" },
  });
  if (locked.count === 0) {
    return NextResponse.json(
      { ok: false, error: "Pipeline already running for this job" },
      { status: 409 }
    );
  }

  try {
    await runPipeline(id);
    const updated = await db.job.findUnique({ where: { id } });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    console.error("pipeline error", e);
    await db.job.update({ where: { id }, data: { status: "failed" } }).catch(() => {});
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
