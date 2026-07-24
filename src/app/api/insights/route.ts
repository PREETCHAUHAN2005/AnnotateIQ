import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleissKappa } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/insights — aggregated cross-job insights and trends
export async function GET() {
  const jobs = await db.job.findMany({ orderBy: { createdAt: "asc" } });

  const jobTrends = [];
  let cumulativeUnits = 0;
  let cumulativeAuto = 0;
  let cumulativeHuman = 0;
  let cumulativeHours = 0;

  for (const job of jobs) {
    const finals = await db.final.findMany({ where: { jobId: job.id } });
    const units = await db.unit.findMany({ where: { jobId: job.id } });
    const drafts = await db.draft.findMany({
      where: { unitId: { in: units.map((u) => u.id) } },
    });
    const events = await db.qualityEvent.findMany({ where: { jobId: job.id } });

    const auto = finals.filter((f) => f.route === "auto").length;
    const human = finals.filter((f) => f.route === "human").length;
    const reviewed = finals.filter((f) => f.reviewerAction).length;
    const avgConf = finals.length ? finals.reduce((a, f) => a + f.confidence, 0) / finals.length : 0;

    // honeypot
    const hpPass = events.filter((e) => e.kind === "honeypot_pass").length;
    const hpFail = events.filter((e) => e.kind === "honeypot_fail").length;
    const hpAccuracy = hpPass + hpFail > 0 ? hpPass / (hpPass + hpFail) : 0;

    // kappa
    const chapterRatings: string[][] = [];
    for (const u of units) {
      const tax = drafts.filter((d) => d.unitId === u.id && d.agent === "taxonomy" && d.attempt === 1);
      if (tax.length >= 2) chapterRatings.push(tax.map((d) => (JSON.parse(d.payload) as { chapter: string }).chapter));
    }
    const kappa = fleissKappa(chapterRatings);

    // hours saved
    const manualMin = finals.length * 4;
    const actualMin = auto * 0 + human * 1;
    const hoursSaved = Math.max(0, (manualMin - actualMin) / 60);

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
      kappa,
      hoursSaved,
      cumulativeUnits,
      cumulativeAuto,
      cumulativeHuman,
      cumulativeHours,
    });
  }

  // aggregate distributions
  const allFinals = await db.final.findMany({});
  const difficultyDist: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const bloomDist: Record<string, number> = { remember: 0, understand: 0, apply: 0, analyze: 0 };
  const languageDist: Record<string, number> = { en: 0, hi: 0, hinglish: 0 };

  for (const f of allFinals) {
    const p = JSON.parse(f.payload) as { difficulty: string; bloom: string; language: string };
    difficultyDist[p.difficulty] = (difficultyDist[p.difficulty] ?? 0) + 1;
    bloomDist[p.bloom] = (bloomDist[p.bloom] ?? 0) + 1;
    languageDist[p.language] = (languageDist[p.language] ?? 0) + 1;
  }

  const totalFinals = allFinals.length;
  const totalAuto = allFinals.filter((f) => f.route === "auto").length;
  const totalHuman = allFinals.filter((f) => f.route === "human").length;
  const overallAutoRate = totalFinals ? totalAuto / totalFinals : 0;
  const overallAvgConf = totalFinals ? allFinals.reduce((a, f) => a + f.confidence, 0) / totalFinals : 0;

  return NextResponse.json({
    summary: {
      totalJobs: jobs.length,
      totalUnits: cumulativeUnits,
      totalAuto: cumulativeAuto,
      totalHuman: cumulativeHuman,
      overallAutoRate,
      overallAvgConf,
      totalHoursSaved: cumulativeHours,
    },
    trends: jobTrends,
    distributions: {
      difficulty: difficultyDist,
      bloom: bloomDist,
      language: languageDist,
    },
  });
}
