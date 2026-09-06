/**
 * Held-out evaluation for the Razorpay AI Risk Manager track.
 *
 * Gold never enters specialist inputs (`isFraud` is stripped; honeypot gold
 * lives on the unit row). Precision / recall are computed on that held-out
 * set after the pipeline writes a final. False-positive cost is an explicit
 * INR model, not a proxy for agreement or honeypot accuracy.
 */

export const REVIEW_COST_INR = 40;
export const STEP_UP_FRICTION = 0.12;
export const BLOCK_FRICTION = 1;

const FRAUD_RISK = new Set(["HIGH", "CRITICAL"]);
const BLOCK_ACTION = new Set(["HOLD", "REJECT"]);

export type ConfusionCounts = {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  n: number;
  precision: number;
  recall: number;
  f1: number;
};

export type FpCost = {
  currency: "INR";
  reviewCostPerAlarm: number;
  blockedLegitimateGmv: number;
  stepUpFriction: number;
  reviewOpsCost: number;
  total: number;
  falsePositives: number;
  notes: string;
};

export type FnCost = {
  currency: "INR";
  missedFraudGmv: number;
  falseNegatives: number;
  notes: string;
};

export type HeldOutReport = {
  n: number;
  labeled: number;
  source: string;
  positiveClass: string;
  risk: ConfusionCounts;
  action: ConfusionCounts;
  falsePositiveCost: FpCost;
  falseNegativeCost: FnCost;
};

export type HeldOutPair = {
  goldRisk: string;
  goldAction: string;
  predRisk: string;
  predAction: string;
  amount: number;
};

function ratio(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function f1(precision: number, recall: number): number {
  const s = precision + recall;
  return s === 0 ? 0 : (2 * precision * recall) / s;
}

function confusion(pairs: { gold: boolean; pred: boolean }[]): ConfusionCounts {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const p of pairs) {
    if (p.gold && p.pred) tp++;
    else if (!p.gold && p.pred) fp++;
    else if (p.gold && !p.pred) fn++;
    else tn++;
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return { tp, fp, fn, tn, n: pairs.length, precision, recall, f1: f1(precision, recall) };
}

export function emptyHeldOut(): HeldOutReport {
  const z: ConfusionCounts = { tp: 0, fp: 0, fn: 0, tn: 0, n: 0, precision: 0, recall: 0, f1: 0 };
  return {
    n: 0,
    labeled: 0,
    source: "Frozen honeypots and IEEE-CIS isFraud gold. Specialists never see gold labels.",
    positiveClass: "Fraud = risk HIGH/CRITICAL. Block = action HOLD/REJECT.",
    risk: z,
    action: z,
    falsePositiveCost: {
      currency: "INR",
      reviewCostPerAlarm: REVIEW_COST_INR,
      blockedLegitimateGmv: 0,
      stepUpFriction: 0,
      reviewOpsCost: 0,
      total: 0,
      falsePositives: 0,
      notes: COST_NOTES,
    },
    falseNegativeCost: {
      currency: "INR",
      missedFraudGmv: 0,
      falseNegatives: 0,
      notes: "Sum of amounts on gold-fraud events predicted LOW/MEDIUM (missed loss).",
    },
  };
}

const COST_NOTES =
  `FP cost (INR) = blocked GMV on HOLD/REJECT of gold-negative events ` +
  `(×${BLOCK_FRICTION}) + ${Math.round(STEP_UP_FRICTION * 100)}% of amount on STEP_UP of gold-negative ` +
  `events + ₹${REVIEW_COST_INR} ops per false-positive alarm. Not a substitute for agreement or honeypot accuracy.`;

export function amountFromRaw(rawText: string | null | undefined): number {
  if (!rawText) return 0;
  try {
    const parsed = JSON.parse(rawText) as { amount?: unknown; order_value?: unknown };
    const n = Number(parsed.amount ?? parsed.order_value ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function parseGold(raw: string | null | undefined): { risk: string; action: string } | null {
  if (!raw) return null;
  try {
    const g = JSON.parse(raw) as { risk_label?: string; recommended_action?: string };
    if (!g.risk_label) return null;
    return { risk: g.risk_label, action: g.recommended_action ?? "REVIEW" };
  } catch {
    return null;
  }
}

export function parsePred(raw: string | null | undefined): { risk: string; action: string } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { risk_label?: string; recommended_action?: string };
    if (!p.risk_label) return null;
    return { risk: p.risk_label, action: p.recommended_action ?? "REVIEW" };
  } catch {
    return null;
  }
}

export function evaluateHeldOut(pairs: HeldOutPair[]): HeldOutReport {
  const base = emptyHeldOut();
  if (pairs.length === 0) return base;

  const risk = confusion(
    pairs.map((p) => ({ gold: FRAUD_RISK.has(p.goldRisk), pred: FRAUD_RISK.has(p.predRisk) }))
  );
  const action = confusion(
    pairs.map((p) => ({ gold: BLOCK_ACTION.has(p.goldAction), pred: BLOCK_ACTION.has(p.predAction) }))
  );

  let blockedLegitimateGmv = 0;
  let stepUpFriction = 0;
  let reviewOpsCost = 0;
  let missedFraudGmv = 0;

  for (const p of pairs) {
    const goldFraud = FRAUD_RISK.has(p.goldRisk);
    const predFraud = FRAUD_RISK.has(p.predRisk);
    if (goldFraud && !predFraud) missedFraudGmv += p.amount;
    if (!goldFraud && predFraud) {
      reviewOpsCost += REVIEW_COST_INR;
      if (p.predAction === "HOLD" || p.predAction === "REJECT") blockedLegitimateGmv += p.amount * BLOCK_FRICTION;
      else if (p.predAction === "STEP_UP_VERIFICATION") stepUpFriction += p.amount * STEP_UP_FRICTION;
    }
  }

  return {
    ...base,
    n: pairs.length,
    labeled: pairs.length,
    risk,
    action,
    falsePositiveCost: {
      currency: "INR",
      reviewCostPerAlarm: REVIEW_COST_INR,
      blockedLegitimateGmv,
      stepUpFriction,
      reviewOpsCost,
      total: blockedLegitimateGmv + stepUpFriction + reviewOpsCost,
      falsePositives: risk.fp,
      notes: COST_NOTES,
    },
    falseNegativeCost: {
      currency: "INR",
      missedFraudGmv,
      falseNegatives: risk.fn,
      notes: "Sum of amounts on gold-fraud events predicted LOW/MEDIUM (missed loss).",
    },
  };
}

export function pairsFromLabeledUnits(
  units: { id: string; goldPayload: string | null; rawText: string }[],
  finals: { unitId: string; payload: string }[]
): HeldOutPair[] {
  const byUnit = new Map(finals.map((f) => [f.unitId, f.payload]));
  const out: HeldOutPair[] = [];
  for (const u of units) {
    const gold = parseGold(u.goldPayload);
    const pred = parsePred(byUnit.get(u.id));
    if (!gold || !pred) continue;
    out.push({
      goldRisk: gold.risk,
      goldAction: gold.action,
      predRisk: pred.risk,
      predAction: pred.action,
      amount: amountFromRaw(u.rawText),
    });
  }
  return out;
}
