export const K = 3;
export const CRITICAL_FIELDS = ["risk_label", "recommended_action"] as const;
export const THRESHOLD = 0.85;
export const MAX_ATTEMPTS = 2;
export const CONCURRENCY = 2;

type CriticalField = (typeof CRITICAL_FIELDS)[number];

export function score(
  samples: { risk_label: string[]; recommended_action: string[] },
  criticPassed: boolean,
  disputed = false
): { confidence: number; agreement: number } {
  const fieldConf: Record<CriticalField, number> = {
    risk_label: modalAgreement(samples.risk_label),
    recommended_action: modalAgreement(samples.recommended_action),
  };
  const agreement = Math.min(fieldConf.risk_label, fieldConf.recommended_action);
  let confidence = agreement * (criticPassed ? 1.0 : 0.6);
  if (disputed) confidence *= 0.7;
  return { confidence, agreement };
}

function modalAgreement(vals: string[]): number {
  if (vals.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  return max / vals.length;
}

export function routeFor(confidence: number, disputed = false): "auto" | "human" {
  if (disputed) return "human";
  return confidence >= THRESHOLD ? "auto" : "human";
}

export function fleissKappa(vals: string[][]): number {
  const N = vals.length;
  if (N === 0) return 0;
  const k = vals[0]?.length ?? 0;
  if (k < 2) return 0;

  const categoryTotals: Record<string, number> = {};
  const itemAgreement: number[] = [];

  for (const row of vals) {
    const counts: Record<string, number> = {};
    for (const v of row) counts[v] = (counts[v] ?? 0) + 1;
    let sumSq = 0;
    for (const [cat, c] of Object.entries(counts)) {
      sumSq += c * c;
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + c;
    }
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
