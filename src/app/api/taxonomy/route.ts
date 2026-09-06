import { db } from "@/lib/db";
import { RISK_LABELS } from "@/lib/schemas";
import { withDbJson } from "@/lib/route-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withDbJson("[GET /api/taxonomy]", async () => {
  const finals = await db.final.findMany({ include: { unit: true } });
  const stats: Record<
    string,
    { count: number; autoCount: number; humanCount: number; avgConfidence: number; actions: Record<string, number>; factors: Record<string, number> }
  > = {};

  for (const f of finals) {
    const p = JSON.parse(f.payload) as {
      risk_label?: string;
      recommended_action?: string;
      risk_factors?: string[];
      confidence?: number;
    };
    const name = p.risk_label ?? "LOW";
    if (!stats[name]) {
      stats[name] = { count: 0, autoCount: 0, humanCount: 0, avgConfidence: 0, actions: {}, factors: {} };
    }
    const s = stats[name];
    s.count++;
    if (f.route === "auto") s.autoCount++;
    else s.humanCount++;
    s.avgConfidence += p.confidence ?? f.confidence;
    const act = p.recommended_action ?? "REVIEW";
    s.actions[act] = (s.actions[act] ?? 0) + 1;
    for (const c of p.risk_factors ?? []) s.factors[c] = (s.factors[c] ?? 0) + 1;
  }

  const labels = RISK_LABELS.map((name) => {
    const s = stats[name];
    if (!s) {
      return {
        name,
        count: 0,
        autoCount: 0,
        humanCount: 0,
        avgConfidence: 0,
        autoRate: 0,
        actions: {},
        topFactors: [],
      };
    }
    return {
      name,
      count: s.count,
      autoCount: s.autoCount,
      humanCount: s.humanCount,
      avgConfidence: s.count > 0 ? s.avgConfidence / s.count : 0,
      autoRate: s.count > 0 ? s.autoCount / s.count : 0,
      actions: s.actions,
      topFactors: Object.entries(s.factors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([factor, count]) => ({ factor, count })),
    };
  });

  return {
    totalLabels: RISK_LABELS.length,
    coveredLabels: labels.filter((c) => c.count > 0).length,
    totalEvents: finals.length,
    labels: labels.sort((a, b) => b.count - a.count),
  };
  }, { totalLabels: 0, coveredLabels: 0, totalEvents: 0, labels: [] });
}
