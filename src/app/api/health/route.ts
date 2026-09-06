import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { isSkipLlm, predictionMode, predictionModeLabel } from "@/lib/prediction-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — system health check
export async function GET() {
  try {
    await ensureDb();
    const [jobs, activeJobs, failedJobs, totalUnits, pendingUnits, labeledUnits, reviewedUnits] =
      await Promise.all([
        db.job.count(),
        db.job.count({ where: { status: { in: ["labeling", "extracting"] } } }),
        db.job.count({ where: { status: "failed" } }),
        db.unit.count(),
        db.unit.count({ where: { status: "pending" } }),
        db.unit.count({ where: { status: { in: ["labeled", "reviewed"] } } }),
        db.unit.count({ where: { status: "reviewed" } }),
      ]);

    // Running a pipeline is healthy activity; only fail/down/pending backlog → degraded
    let status: "healthy" | "degraded" | "down" = "healthy";
    if (failedJobs > 0 || (totalUnits > 0 && pendingUnits > totalUnits * 0.5)) status = "degraded";

    const skipLlm = isSkipLlm();
    return NextResponse.json({
      status,
      jobs,
      activeJobs,
      totalUnits,
      pendingUnits,
      labeledUnits,
      reviewedUnits,
      agentsAvailable: 9,
      dbConnected: true,
      skipLlm,
      predictionMode: predictionMode(),
      demoLabel: predictionModeLabel(),
      ephemeralSqlite: Boolean(process.env.VERCEL),
    });
  } catch (e) {
    console.error("[GET /api/health]", e);
    // Always 200 so clients can render a "down" state instead of spinning forever
    return NextResponse.json({
      status: "down",
      jobs: 0,
      activeJobs: 0,
      totalUnits: 0,
      pendingUnits: 0,
      labeledUnits: 0,
      reviewedUnits: 0,
      agentsAvailable: 0,
      dbConnected: false,
      skipLlm: isSkipLlm(),
      predictionMode: predictionMode(),
      demoLabel: predictionModeLabel(),
      ephemeralSqlite: Boolean(process.env.VERCEL),
    });
  }
}
