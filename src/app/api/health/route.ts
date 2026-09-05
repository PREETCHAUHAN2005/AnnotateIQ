import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — system health check
export async function GET() {
  try {
    const jobs = await db.job.findMany();
    const units = await db.unit.findMany();
    const totalUnits = units.length;
    const pendingUnits = units.filter((u) => u.status === "pending").length;
    const labeledUnits = units.filter((u) => u.status === "labeled" || u.status === "reviewed").length;
    const activeJobs = jobs.filter((j) => j.status === "labeling" || j.status === "extracting").length;
    const failedJobs = jobs.filter((j) => j.status === "failed").length;

    // Running a pipeline is healthy activity; only fail/down/pending backlog → degraded
    let status: "healthy" | "degraded" | "down" = "healthy";
    if (failedJobs > 0 || pendingUnits > totalUnits * 0.5) status = "degraded";

    return NextResponse.json({
      status,
      jobs: jobs.length,
      activeJobs,
      totalUnits,
      pendingUnits,
      labeledUnits,
      reviewedUnits: units.filter((u) => u.status === "reviewed").length,
      agentsAvailable: 7,
      dbConnected: true,
    });
  } catch {
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
    });
  }
}
