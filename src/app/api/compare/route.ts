import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleissKappa, kappaVerdict } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/compare — compare stats across all jobs for the comparison view.
export async function GET(_req: NextRequest) {
  const jobs = await db.job.findMany({ orderBy: { createdAt: "desc" } });

  const comparison = [];
  for (const job of jobs) {
    const finals = await db.final.findMany({ where: { jobId: job.id } });
    const units = await db.unit.findMany({ where: { jobId: job.id } });
    const auto = finals.filter((f) => f.route === "auto").length;
    const human = finals.filter((f) => f.route === "human").length;
    const reviewed = finals.filter((f) => f.reviewerAction).length;
    const avgConf = finals.length ? finals.reduce((a, f) => a + f.confidence, 0) / finals.length : 0;

    // honeypot stats
    const honeypotUnits = units.filter((u) => u.isHoneypot);
    const events = await db.qualityEvent.findMany({ where: { jobId: job.id } });
    const hpPass = events.filter((e) => e.kind === "honeypot_pass").length;
    const hpFail = events.filter((e) => e.kind === "honeypot_fail").length;

    // difficulty distribution
    const distDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    for (const f of finals) {
      const p = JSON.parse(f.payload) as { difficulty: string };
      distDifficulty[p.difficulty] = (distDifficulty[p.difficulty] ?? 0) + 1;
    }

    // fleiss kappa for chapter
    const drafts = await db.draft.findMany({
      where: { unitId: { in: units.map((u) => u.id) } },
    });
    const chapterRatings: string[][] = [];
    for (const u of units) {
      const tax = drafts.filter((d) => d.unitId === u.id && d.agent === "taxonomy" && d.attempt === 1);
      if (tax.length >= 2) chapterRatings.push(tax.map((d) => (JSON.parse(d.payload) as { chapter: string }).chapter));
    }
    const kappaChapter = fleissKappa(chapterRatings);

    comparison.push({
      id: job.id,
      filename: job.filename,
      status: job.status,
      unitCount: job.unitCount,
      finals: finals.length,
      auto,
      human,
      reviewed,
      autoRate: finals.length ? auto / finals.length : 0,
      avgConfidence: avgConf,
      honeypots: honeypotUnits.length,
      honeypotPass: hpPass,
      honeypotFail: hpFail,
      honeypotAccuracy: hpPass + hpFail > 0 ? hpPass / (hpPass + hpFail) : 0,
      kappaChapter: { value: kappaChapter, ...kappaVerdict(kappaChapter) },
      distDifficulty,
    });
  }

  return NextResponse.json({ jobs: comparison });
}
