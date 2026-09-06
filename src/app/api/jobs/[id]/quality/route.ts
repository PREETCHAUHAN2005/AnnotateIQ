import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluateHeldOut, pairsFromLabeledUnits } from "@/lib/held-out";
import { dbRouteError } from "@/lib/route-error";
import { fleissKappa, honeypotAccuracy, kappaVerdict } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const finals = await db.final.findMany({ where: { jobId: id }, include: { unit: true } });
  const units = await db.unit.findMany({ where: { jobId: id }, orderBy: { seq: "asc" } });
  const drafts = await db.draft.findMany({ where: { unitId: { in: units.map((u) => u.id) } } });
  const events = await db.qualityEvent.findMany({ where: { jobId: id } });

  const autoCount = finals.filter((f) => f.route === "auto").length;
  const humanCount = finals.filter((f) => f.route === "human").length;
  const autoRate = finals.length ? autoCount / finals.length : 0;

  const honeypotUnits = units.filter((u) => u.isHoneypot);
  const comparisons: { agent: string; field: string; predicted: string; gold: string }[] = [];
  for (const u of honeypotUnits) {
    if (!u.goldPayload) continue;
    const gold = JSON.parse(u.goldPayload) as {
      risk_label?: string;
      recommended_action?: string;
      risk_cluster_id?: string | null;
      failure_reason?: string;
      retryability?: string;
    };
    const reasonDrafts = drafts.filter((d) => d.unitId === u.id && d.agent === "fraud_reasoning" && d.attempt === 1);
    for (const d of reasonDrafts) {
      const p = JSON.parse(d.payload) as { risk_label?: string; recommended_action?: string };
      if (p.risk_label && gold.risk_label)
        comparisons.push({ agent: "fraud_reasoning", field: "risk_label", predicted: p.risk_label, gold: gold.risk_label });
      if (p.recommended_action && gold.recommended_action)
        comparisons.push({
          agent: "fraud_reasoning",
          field: "recommended_action",
          predicted: p.recommended_action,
          gold: gold.recommended_action,
        });
    }
    if (gold.failure_reason) {
      const failDrafts = drafts.filter((d) => d.unitId === u.id && d.agent === "failure_classifier" && d.attempt === 1);
      for (const d of failDrafts) {
        const p = JSON.parse(d.payload) as { failure_reason?: string };
        if (p.failure_reason) {
          comparisons.push({
            agent: "failure_classifier",
            field: "failure_reason",
            predicted: p.failure_reason,
            gold: gold.failure_reason,
          });
        }
      }
    }
    if (gold.retryability) {
      const retryDrafts = drafts.filter((d) => d.unitId === u.id && d.agent === "retry_routing" && d.attempt === 1);
      for (const d of retryDrafts) {
        const p = JSON.parse(d.payload) as { retryability?: string };
        if (p.retryability) {
          comparisons.push({
            agent: "retry_routing",
            field: "retryability",
            predicted: p.retryability,
            gold: gold.retryability,
          });
        }
      }
    }
    if (gold.risk_cluster_id) {
      const ringDrafts = drafts.filter((d) => d.unitId === u.id && d.agent === "ring_analyst" && d.attempt === 1);
      for (const d of ringDrafts) {
        const p = JSON.parse(d.payload) as { risk_cluster_id?: string | null };
        if (p.risk_cluster_id) {
          comparisons.push({
            agent: "ring_analyst",
            field: "risk_cluster_id",
            predicted: p.risk_cluster_id,
            gold: gold.risk_cluster_id,
          });
        }
      }
    }
  }
  const { perAgent } = honeypotAccuracy(comparisons);

  const labelRatings: string[][] = [];
  const actionRatings: string[][] = [];
  for (const u of units) {
    const rows = drafts.filter((d) => d.unitId === u.id && d.agent === "fraud_reasoning" && d.attempt === 1);
    if (rows.length >= 2) {
      labelRatings.push(rows.map((d) => (JSON.parse(d.payload) as { risk_label: string }).risk_label));
      actionRatings.push(rows.map((d) => (JSON.parse(d.payload) as { recommended_action: string }).recommended_action));
    }
  }
  const kappaLabel = fleissKappa(labelRatings);
  const kappaAction = fleissKappa(actionRatings);

  const reviewed = finals.filter((f) => f.route === "auto" || f.reviewerAction === "accept" || f.reviewerAction === "edit").length;
  const manualMin = finals.length * 4;
  const actualMin = autoCount * 0 + humanCount * 1;
  const hoursSaved = Math.max(0, (manualMin - actualMin) / 60);

  const eventTally: Record<string, number> = {};
  for (const e of events) eventTally[e.kind] = (eventTally[e.kind] ?? 0) + 1;

  const distRisk: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const distAction: Record<string, number> = {
    ALLOW: 0,
    REVIEW: 0,
    STEP_UP_VERIFICATION: 0,
    HOLD: 0,
    REJECT: 0,
  };
  const distCb: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const distCons: Record<string, number> = { AGREED: 0, DISPUTED: 0 };

  const confByLabel: Record<string, { sum: number; count: number }> = {};
  for (const f of finals) {
    const p = JSON.parse(f.payload) as {
      risk_label?: string;
      recommended_action?: string;
      chargeback_risk?: string;
      consensus?: string;
    };
    distRisk[p.risk_label ?? "LOW"] = (distRisk[p.risk_label ?? "LOW"] ?? 0) + 1;
    distAction[p.recommended_action ?? "REVIEW"] = (distAction[p.recommended_action ?? "REVIEW"] ?? 0) + 1;
    distCb[p.chargeback_risk ?? "LOW"] = (distCb[p.chargeback_risk ?? "LOW"] ?? 0) + 1;
    distCons[p.consensus ?? "AGREED"] = (distCons[p.consensus ?? "AGREED"] ?? 0) + 1;
    const lab = p.risk_label ?? "LOW";
    confByLabel[lab] ??= { sum: 0, count: 0 };
    confByLabel[lab].sum += f.confidence;
    confByLabel[lab].count++;
  }

  const goldUnits = units.filter((u) => u.goldPayload);
  const heldOut = evaluateHeldOut(
    pairsFromLabeledUnits(
      goldUnits.map((u) => ({ id: u.id, goldPayload: u.goldPayload, rawText: u.rawText })),
      finals.map((f) => ({ unitId: f.unitId, payload: f.payload }))
    )
  );

  return NextResponse.json({
    job: { id: job.id, filename: job.filename, status: job.status, unitCount: job.unitCount },
    totals: {
      units: units.length,
      finals: finals.length,
      auto: autoCount,
      human: humanCount,
      reviewed,
      honeypots: honeypotUnits.length,
    },
    heldOut,
    rates: { autoRate, hoursSaved, manualMinutes: manualMin, actualMinutes: actualMin },
    kappa: {
      risk_label: { value: kappaLabel, ...kappaVerdict(kappaLabel), n: labelRatings.length },
      recommended_action: { value: kappaAction, ...kappaVerdict(kappaAction), n: actionRatings.length },
    },
    honeypot: {
      perAgent,
      total: comparisons.length,
      pass: events.filter((e) => e.kind === "honeypot_pass").length,
      fail: events.filter((e) => e.kind === "honeypot_fail").length,
    },
    events: eventTally,
    distributions: {
      risk_label: distRisk,
      recommended_action: distAction,
      chargeback_risk: distCb,
      consensus: distCons,
    },
    latency: computeLatency(drafts),
    confidenceBuckets: computeConfidenceBuckets(finals),
    avgConfByLabel: Object.entries(confByLabel)
      .map(([label, v]) => ({ label, avg: v.sum / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg),
  });
  } catch (e) {
    return dbRouteError("[GET /api/jobs/:id/quality]", e);
  }
}

function computeLatency(drafts: { agent: string; latencyMs: number | null; attempt: number }[]) {
  const agents = [
    "transaction_risk",
    "behavioral",
    "device_network",
    "merchant_order",
    "fraud_reasoning",
    "adjudicator",
    "ring_analyst",
    "failure_classifier",
    "retry_routing",
  ];
  const out: Record<string, { avg: number; min: number; max: number; count: number; p95: number }> = {};
  for (const agent of agents) {
    const lats = drafts
      .filter((d) => d.agent === agent && d.attempt === 1 && d.latencyMs != null)
      .map((d) => d.latencyMs as number);
    if (lats.length === 0) {
      out[agent] = { avg: 0, min: 0, max: 0, count: 0, p95: 0 };
      continue;
    }
    lats.sort((a, b) => a - b);
    const sum = lats.reduce((a, b) => a + b, 0);
    const p95idx = Math.min(lats.length - 1, Math.floor(lats.length * 0.95));
    out[agent] = {
      avg: Math.round(sum / lats.length),
      min: lats[0],
      max: lats[lats.length - 1],
      count: lats.length,
      p95: lats[p95idx],
    };
  }
  return out;
}

function computeConfidenceBuckets(finals: { confidence: number }[]) {
  const buckets = [
    { label: "0.0–0.5", min: 0, max: 0.5, count: 0 },
    { label: "0.5–0.7", min: 0.5, max: 0.7, count: 0 },
    { label: "0.7–0.85", min: 0.7, max: 0.85, count: 0 },
    { label: "0.85–0.95", min: 0.85, max: 0.95, count: 0 },
    { label: "0.95–1.0", min: 0.95, max: 1.01, count: 0 },
  ];
  for (const f of finals) {
    for (const b of buckets) {
      if (f.confidence >= b.min && f.confidence < b.max) {
        b.count++;
        break;
      }
    }
  }
  return buckets.map((b) => ({ label: b.label, count: b.count }));
}
