import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleissKappa, honeypotAccuracy, kappaVerdict } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/quality — corpus-level quality stats for the dashboard.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const job = await db.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const finals = await db.final.findMany({ where: { jobId: id }, include: { unit: true } });
  const units = await db.unit.findMany({ where: { jobId: id }, orderBy: { seq: "asc" } });
  const drafts = await db.draft.findMany({
    where: { unitId: { in: units.map((u) => u.id) } },
  });
  const events = await db.qualityEvent.findMany({ where: { jobId: id } });

  // ---- Auto-accept rate ----
  const autoCount = finals.filter((f) => f.route === "auto").length;
  const humanCount = finals.filter((f) => f.route === "human").length;
  const autoRate = finals.length ? autoCount / finals.length : 0;

  // ---- Honeypot accuracy (per-agent on chapter & difficulty, gold vs predicted) ----
  const honeypotUnits = units.filter((u) => u.isHoneypot);
  const comparisons: { agent: string; field: string; predicted: string; gold: string }[] = [];
  for (const u of honeypotUnits) {
    if (!u.goldPayload) continue;
    const gold = JSON.parse(u.goldPayload) as { chapter: string; difficulty: string };
    // taxonomy drafts -> chapter; difficulty drafts -> difficulty
    const taxDrafts = drafts.filter((d) => d.unitId === u.id && d.agent === "taxonomy" && d.attempt === 1);
    const diffDrafts = drafts.filter((d) => d.unitId === u.id && d.agent === "difficulty" && d.attempt === 1);
    for (const d of taxDrafts) {
      const p = JSON.parse(d.payload) as { chapter?: string };
      if (p.chapter) comparisons.push({ agent: "taxonomy", field: "chapter", predicted: p.chapter, gold: gold.chapter });
    }
    for (const d of diffDrafts) {
      const p = JSON.parse(d.payload) as { difficulty?: string };
      if (p.difficulty) comparisons.push({ agent: "difficulty", field: "difficulty", predicted: p.difficulty, gold: gold.difficulty });
    }
  }
  const { perAgent } = honeypotAccuracy(comparisons);

  // ---- Fleiss' kappa per critical field (corpus stat, across all units, attempt 1) ----
  const chapterRatings: string[][] = [];
  const difficultyRatings: string[][] = [];
  for (const u of units) {
    const tax = drafts.filter((d) => d.unitId === u.id && d.agent === "taxonomy" && d.attempt === 1);
    const diff = drafts.filter((d) => d.unitId === u.id && d.agent === "difficulty" && d.attempt === 1);
    if (tax.length >= 2) chapterRatings.push(tax.map((d) => (JSON.parse(d.payload) as { chapter: string }).chapter));
    if (diff.length >= 2) difficultyRatings.push(diff.map((d) => (JSON.parse(d.payload) as { difficulty: string }).difficulty));
  }
  const kappaChapter = fleissKappa(chapterRatings);
  const kappaDifficulty = fleissKappa(difficultyRatings);

  // ---- Hours saved vs 4 min/question manual baseline ----
  const reviewed = finals.filter((f) => f.route === "auto" || f.reviewerAction === "accept" || f.reviewerAction === "edit").length;
  // assume reviewer spends ~1 min on each human-routed unit, 0 min on auto; baseline 4 min each
  const manualMin = finals.length * 4;
  const actualMin = autoCount * 0 + humanCount * 1;
  const hoursSaved = Math.max(0, (manualMin - actualMin) / 60);

  // ---- Event tally ----
  const eventTally: Record<string, number> = {};
  for (const e of events) eventTally[e.kind] = (eventTally[e.kind] ?? 0) + 1;

  // ---- Difficulty distribution (for chart) ----
  const distDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const f of finals) {
    const p = JSON.parse(f.payload) as { difficulty: string };
    distDifficulty[p.difficulty] = (distDifficulty[p.difficulty] ?? 0) + 1;
  }

  // ---- Chapter distribution (for chart) ----
  const distChapter: Record<string, number> = {};
  for (const f of finals) {
    const p = JSON.parse(f.payload) as { chapter: string };
    distChapter[p.chapter] = (distChapter[p.chapter] ?? 0) + 1;
  }

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
    rates: {
      autoRate,
      hoursSaved,
      manualMinutes: manualMin,
      actualMinutes: actualMin,
    },
    kappa: {
      chapter: { value: kappaChapter, ...kappaVerdict(kappaChapter), n: chapterRatings.length },
      difficulty: { value: kappaDifficulty, ...kappaVerdict(kappaDifficulty), n: difficultyRatings.length },
    },
    honeypot: {
      perAgent,
      total: comparisons.length,
      pass: events.filter((e) => e.kind === "honeypot_pass").length,
      fail: events.filter((e) => e.kind === "honeypot_fail").length,
    },
    events: eventTally,
    distributions: {
      difficulty: distDifficulty,
      chapter: distChapter,
    },
    // per-agent latency stats (attempt 1 only)
    latency: computeLatency(drafts),
    // confidence distribution buckets
    confidenceBuckets: computeConfidenceBuckets(finals),
  });
}

function computeLatency(drafts: { agent: string; latencyMs: number | null; attempt: number }[]) {
  const agents = ["taxonomy", "difficulty", "math", "language", "critic"];
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
