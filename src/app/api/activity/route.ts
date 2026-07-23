import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/activity — chronological event log across all jobs
// Optional query params: ?jobId=xxx&kind=xxx&limit=50
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  const kind = req.nextUrl.searchParams.get("kind");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (kind) where.kind = kind;

  const events = await db.qualityEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
    include: { unit: { select: { seq: true, stem: true, jobId: true } }, job: { select: { filename: true } } },
  });

  // also include job status changes (created jobs)
  const jobs = await db.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, filename: true, status: true, unitCount: true, autoCount: true, humanCount: true, createdAt: true },
  });

  const jobEvents = jobs.map((j) => ({
    id: `job-${j.id}`,
    type: "job_created",
    jobId: j.id,
    unitId: null,
    seq: null,
    jobFilename: j.filename,
    kind: "job_created",
    detail: JSON.stringify({ status: j.status, unitCount: j.unitCount, autoCount: j.autoCount, humanCount: j.humanCount }),
    createdAt: j.createdAt,
  }));

  const qualityEvents = events.map((e) => ({
    id: e.id,
    type: "quality_event",
    jobId: e.jobId,
    unitId: e.unitId,
    seq: e.unit?.seq ?? null,
    stem: e.unit?.stem?.slice(0, 80) ?? null,
    jobFilename: e.job?.filename ?? null,
    kind: e.kind,
    detail: e.detail,
    createdAt: e.createdAt,
  }));

  // merge and sort by date desc
  const all = [...jobEvents, ...qualityEvents]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, Math.min(limit, 100));

  return NextResponse.json({
    events: all,
    total: all.length,
    kinds: ["job_created", "honeypot_pass", "honeypot_fail", "critic_fail", "schema_fail", "disagreement", "retry"],
  });
}
