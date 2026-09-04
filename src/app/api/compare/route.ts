import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleissKappa, kappaVerdict } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const honeypotUnits = units.filter((u) => u.isHoneypot);
    const events = await db.qualityEvent.findMany({ where: { jobId: job.id } });
    const hpPass = events.filter((e) => e.kind === "honeypot_pass").length;
    const hpFail = events.filter((e) => e.kind === "honeypot_fail").length;

    const distRisk: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const f of finals) {
      const p = JSON.parse(f.payload) as { risk_label?: string };
      distRisk[p.risk_label ?? "LOW"] = (distRisk[p.risk_label ?? "LOW"] ?? 0) + 1;
    }

    const drafts = await db.draft.findMany({ where: { unitId: { in: units.map((u) => u.id) } } });
    const labelRatings: string[][] = [];
    for (const u of units) {
      const rows = drafts.filter((d) => d.unitId === u.id && d.agent === "fraud_reasoning" && d.attempt === 1);
      if (rows.length >= 2) labelRatings.push(rows.map((d) => (JSON.parse(d.payload) as { risk_label: string }).risk_label));
    }
    const kappaRisk = fleissKappa(labelRatings);

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
      kappaRisk: { value: kappaRisk, ...kappaVerdict(kappaRisk) },
      distRisk,
    });
  }
  return NextResponse.json({ jobs: comparison });
}
