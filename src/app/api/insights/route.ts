import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleissKappa } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSIGHTS_JOB_CAP = 20;

export async function GET() {
  const recent = await db.job.findMany({ orderBy: { createdAt: "desc" }, take: INSIGHTS_JOB_CAP });
  const jobs = [...recent].reverse();
  const jobTrends = [];
  let cumulativeUnits = 0;
  let cumulativeAuto = 0;
  let cumulativeHuman = 0;
  let cumulativeHours = 0;

  for (const job of jobs) {
    const finals = await db.final.findMany({ where: { jobId: job.id } });
    const units = await db.unit.findMany({ where: { jobId: job.id } });
    const drafts = await db.draft.findMany({ where: { unitId: { in: units.map((u) => u.id) } } });
    const events = await db.qualityEvent.findMany({ where: { jobId: job.id } });

    const auto = finals.filter((f) => f.route === "auto").length;
    const human = finals.filter((f) => f.route === "human").length;
    const reviewed = finals.filter((f) => f.reviewerAction).length;
    const avgConf = finals.length ? finals.reduce((a, f) => a + f.confidence, 0) / finals.length : 0;
    const hpPass = events.filter((e) => e.kind === "honeypot_pass").length;
    const hpFail = events.filter((e) => e.kind === "honeypot_fail").length;
    const hpAccuracy = hpPass + hpFail > 0 ? hpPass / (hpPass + hpFail) : 0;

    const labelRatings: string[][] = [];
    for (const u of units) {
      const rows = drafts.filter((d) => d.unitId === u.id && d.agent === "fraud_reasoning" && d.attempt === 1);
      if (rows.length >= 2) {
        labelRatings.push(
          rows.map((d) => {
            try {
              return (JSON.parse(d.payload) as { risk_label: string }).risk_label;
            } catch {
              return "LOW";
            }
          })
        );
      }
    }

    const hoursSaved = Math.max(0, (finals.length * 4 - human * 1) / 60);
    cumulativeUnits += units.length;
    cumulativeAuto += auto;
    cumulativeHuman += human;
    cumulativeHours += hoursSaved;

    jobTrends.push({
      jobId: job.id,
      filename: job.filename,
      createdAt: job.createdAt.toISOString(),
      units: units.length,
      auto,
      human,
      reviewed,
      autoRate: finals.length ? auto / finals.length : 0,
      avgConfidence: avgConf,
      honeypotAccuracy: hpAccuracy,
      kappa: fleissKappa(labelRatings),
      hoursSaved,
      cumulativeUnits,
      cumulativeAuto,
      cumulativeHuman,
      cumulativeHours,
    });
  }

  const allFinals = jobs.length
    ? await db.final.findMany({ where: { jobId: { in: jobs.map((j) => j.id) } } })
    : [];
  const riskDist: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const actionDist: Record<string, number> = {
    ALLOW: 0,
    REVIEW: 0,
    STEP_UP_VERIFICATION: 0,
    HOLD: 0,
    REJECT: 0,
  };
  const consDist: Record<string, number> = { AGREED: 0, DISPUTED: 0 };
  for (const f of allFinals) {
    try {
      const p = JSON.parse(f.payload) as { risk_label?: string; recommended_action?: string; consensus?: string };
      riskDist[p.risk_label ?? "LOW"] = (riskDist[p.risk_label ?? "LOW"] ?? 0) + 1;
      actionDist[p.recommended_action ?? "REVIEW"] = (actionDist[p.recommended_action ?? "REVIEW"] ?? 0) + 1;
      consDist[p.consensus ?? "AGREED"] = (consDist[p.consensus ?? "AGREED"] ?? 0) + 1;
    } catch {
      /* skip corrupt payload */
    }
  }

  const totalFinals = allFinals.length;
  const totalAuto = allFinals.filter((f) => f.route === "auto").length;
  return NextResponse.json({
    summary: {
      totalJobs: jobs.length,
      totalUnits: cumulativeUnits,
      totalAuto: cumulativeAuto,
      totalHuman: cumulativeHuman,
      overallAutoRate: totalFinals ? totalAuto / totalFinals : 0,
      overallAvgConf: totalFinals ? allFinals.reduce((a, f) => a + f.confidence, 0) / totalFinals : 0,
      totalHoursSaved: cumulativeHours,
    },
    trends: jobTrends,
    distributions: { risk_label: riskDist, recommended_action: actionDist, consensus: consDist },
  });
}
