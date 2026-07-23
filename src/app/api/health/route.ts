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

    const status = activeJobs > 0 ? "degraded" : "healthy";

    return NextResponse.json({
      status,
      jobs: jobs.length,
      activeJobs,
      totalUnits,
      pendingUnits,
      labeledUnits,
      reviewedUnits: units.filter((u) => u.status === "reviewed").length,
      agentsAvailable: 5, // taxonomy, difficulty, math, language, critic
      dbConnected: true,
    });
  } catch {
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
    }, { status: 500 });
  }
}
