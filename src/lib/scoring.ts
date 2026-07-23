// §3 — confidence & quality maths

export const K = 3;
export const CRITICAL_FIELDS = ["chapter", "difficulty"] as const;
export const THRESHOLD = 0.85;
export const MAX_ATTEMPTS = 2;
export const CONCURRENCY = 2;

type CriticalField = (typeof CRITICAL_FIELDS)[number];

/**
 * Per-unit routing score. samples maps each critical field to its k samples.
 * agreement = min over critical fields (weakest link, NOT mean).
 * confidence = agreement * (critic_passed ? 1.0 : 0.6)
 */
export function score(
  samples: { chapter: string[]; difficulty: string[] },
  criticPassed: boolean
): { confidence: number; agreement: number } {
  const fieldConf: Record<CriticalField, number> = {
    chapter: modalAgreement(samples.chapter),
    difficulty: modalAgreement(samples.difficulty),
  };
  const agreement = Math.min(fieldConf.chapter, fieldConf.difficulty);
  const confidence = agreement * (criticPassed ? 1.0 : 0.6);
  return { confidence, agreement };
}

function modalAgreement(vals: string[]): number {
  if (vals.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  return max / vals.length;
}

export function routeFor(confidence: number): "auto" | "human" {
  return confidence >= THRESHOLD ? "auto" : "human";
}

/**
 * Fleiss' kappa across N items rated by k raters on a categorical field.
 * vals[i] is the list of k labels for item i. Corpus statistic only — never
 * used for per-unit routing.
 */
export function fleissKappa(vals: string[][]): number {
  const N = vals.length;
  if (N === 0) return 0;
  const k = vals[0]?.length ?? 0;
  if (k < 2) return 0;

  // category totals across all items
  const categoryTotals: Record<string, number> = {};
  const itemAgreement: number[] = [];

  for (const row of vals) {
    const counts: Record<string, number> = {};
    for (const v of row) counts[v] = (counts[v] ?? 0) + 1;
    let sumSq = 0;
    for (const c of Object.values(counts)) {
      sumSq += c * c;
      categoryTotals[c] = (categoryTotals[c] ?? 0) + c;
    }
    // P_i = (sumSq - k) / (k*(k-1))
    const Pi = (sumSq - k) / (k * (k - 1));
    itemAgreement.push(Pi);
  }

  const Pbar = itemAgreement.reduce((a, b) => a + b, 0) / N;
  const total = N * k;
  let Pe = 0;
  for (const n of Object.values(categoryTotals)) {
    const p = n / total;
    Pe += p * p;
  }
  if (1 - Pe === 0) return 1;
  return (Pbar - Pe) / (1 - Pe);
}

/** Compare an agent's draft to the honeypot gold payload for a field set. */
export function honeypotAccuracy(
  comparisons: { agent: string; field: string; predicted: string; gold: string }[]
): { perAgent: Record<string, { correct: number; total: number; accuracy: number }> } {
  const perAgent: Record<string, { correct: number; total: number; accuracy: number }> = {};
  for (const c of comparisons) {
    perAgent[c.agent] ??= { correct: 0, total: 0, accuracy: 0 };
    perAgent[c.agent].total++;
    if (c.predicted.trim().toLowerCase() === c.gold.trim().toLowerCase()) {
      perAgent[c.agent].correct++;
    }
  }
  for (const a of Object.values(perAgent)) {
    a.accuracy = a.total === 0 ? 0 : a.correct / a.total;
  }
  return { perAgent };
}

export function kappaVerdict(kappa: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (kappa > 0.8) return { label: "Production-grade", tone: "good" };
  if (kappa >= 0.6) return { label: "Acceptable", tone: "warn" };
  return { label: "Guideline ambiguity", tone: "bad" };
}
