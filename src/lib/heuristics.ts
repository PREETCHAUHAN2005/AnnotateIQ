import type {
  AdjudicatorOut,
  BehavioralOut,
  CanonicalPaymentEvent,
  DerivedSignals,
  DeviceNetworkOut,
  FraudReasoningOut,
  MerchantOrderOut,
  RiskLevel,
  TransactionRiskOut,
} from "@/lib/schemas";

const DEMO_DISAGREE = process.env.DEMO_DISAGREE === "1";

function bump(level: RiskLevel, up: boolean): RiskLevel {
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const i = order.indexOf(level);
  return order[Math.max(0, Math.min(order.length - 1, i + (up ? 1 : -1)))];
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 0.8) return "CRITICAL";
  if (score >= 0.55) return "HIGH";
  if (score >= 0.3) return "MEDIUM";
  return "LOW";
}

export function heuristicTransactionRisk(
  event: CanonicalPaymentEvent,
  derived: DerivedSignals
): TransactionRiskOut {
  const amount = event.amount ?? 0;
  const failed = event.failed_attempts_1h ?? 0;
  let score = 0;
  if (amount >= 80000) score += 0.45;
  else if (amount >= 20000) score += 0.25;
  if (failed >= 3) score += 0.2;
  if (derived.amount_anomaly) score += 0.2;
  const transaction_risk = riskFromScore(score);
  return {
    transaction_risk,
    evidence: [
      {
        feature: "amount",
        observation: String(amount),
        impact: amount >= 20000 ? "high" : "low",
        agent: "transaction_risk",
      },
    ],
  };
}

export function heuristicBehavioral(
  event: CanonicalPaymentEvent,
  derived: DerivedSignals
): BehavioralOut {
  const failed = event.failed_attempts_1h ?? 0;
  const age = event.account_age ?? 365;
  const anomaly = derived.velocity_score >= 0.35 || failed >= 4 || age < 7;
  let pattern = "NONE";
  if (failed >= 4 && age < 14) pattern = "NEW_ACCOUNT_BURST";
  else if (derived.velocity_score >= 0.35) pattern = "VELOCITY_ANOMALY";
  else if (failed >= 4) pattern = "REPEAT_FAILURE";
  return {
    behavior_anomaly: anomaly,
    behavioral_pattern: pattern,
    evidence: [
      {
        feature: "failed_attempts_1h",
        observation: String(failed),
        impact: failed >= 4 ? "high" : "low",
        agent: "behavioral",
      },
      {
        feature: "account_age",
        observation: `${age} days`,
        impact: age < 7 ? "medium" : "low",
        agent: "behavioral",
      },
    ],
  };
}

export function heuristicDeviceNetwork(
  event: CanonicalPaymentEvent,
  derived: DerivedSignals
): DeviceNetworkOut {
  let score = 0;
  if (derived.geo_mismatch) score += 0.45;
  if (derived.device_reuse_score >= 0.3) score += 0.4;
  return {
    device_risk: riskFromScore(score),
    evidence: [
      {
        feature: "geo_mismatch",
        observation: derived.geo_mismatch
          ? `${event.ip_region} vs ${event.billing_region}/${event.shipping_region}`
          : "regions aligned",
        impact: derived.geo_mismatch ? "high" : "low",
        agent: "device_network",
      },
    ],
  };
}

export function heuristicMerchantOrder(
  event: CanonicalPaymentEvent,
  derived: DerivedSignals
): MerchantOrderOut {
  const cb = event.chargeback_history ?? 0;
  const refunds = event.refund_count_30d ?? 0;
  let score = derived.merchant_risk;
  if ((event.product_category ?? "").match(/jewel|wallet|gaming|travel/i)) score += 0.15;
  if (cb > 0) score += 0.25;
  if (refunds >= 2) score += 0.15;
  return {
    merchant_context_risk: riskFromScore(score),
    evidence: [
      {
        feature: "chargeback_history",
        observation: String(cb),
        impact: cb > 0 ? "high" : "low",
        agent: "merchant_order",
      },
    ],
  };
}

export function heuristicFraudReasoning(
  event: CanonicalPaymentEvent,
  derived: DerivedSignals,
  specialists: {
    transaction_risk: RiskLevel;
    behavior_anomaly: boolean;
    behavioral_pattern: string;
    device_risk: RiskLevel;
    merchant_context_risk: RiskLevel;
  },
  sampleIdx = 0
): FraudReasoningOut {
  const rank = (l: RiskLevel) => ["LOW", "MEDIUM", "HIGH", "CRITICAL"].indexOf(l);
  let top = specialists.transaction_risk;
  for (const l of [specialists.device_risk, specialists.merchant_context_risk]) {
    if (rank(l) > rank(top)) top = l;
  }
  if (specialists.behavior_anomaly && rank(top) < 2) top = "HIGH";

  const factors: string[] = [];
  if (derived.velocity_score >= 0.35) factors.push("high_velocity");
  if ((event.account_age ?? 365) < 7) factors.push("new_account");
  if (derived.device_reuse_score >= 0.3) factors.push("device_reuse");
  if (derived.geo_mismatch) factors.push("geo_mismatch");
  if (derived.amount_anomaly) factors.push("unusual_amount");
  if ((event.chargeback_history ?? 0) > 0) factors.push("chargeback_history");
  if ((event.failed_attempts_1h ?? 0) >= 4) factors.push("failed_attempts");
  if (factors.length === 0) factors.push("none_material");

  let risk_label = top;
  if (DEMO_DISAGREE && sampleIdx === 2) {
    risk_label = bump(top, false);
  }

  const actionMap = {
    LOW: "ALLOW",
    MEDIUM: "REVIEW",
    HIGH: "STEP_UP_VERIFICATION",
    CRITICAL: "HOLD",
  } as const;

  const fraud_probability = Math.min(0.98, 0.15 + rank(risk_label) * 0.25 + derived.velocity_score * 0.2);
  const chargeback_risk =
    (event.chargeback_history ?? 0) > 0 || risk_label === "CRITICAL"
      ? "HIGH"
      : risk_label === "HIGH"
        ? "MEDIUM"
        : "LOW";

  return {
    risk_label,
    recommended_action: actionMap[risk_label],
    fraud_probability: Math.round(fraud_probability * 100) / 100,
    risk_factors: factors.slice(0, 6),
    transaction_anomaly: derived.amount_anomaly || derived.velocity_score >= 0.35,
    chargeback_risk,
    explanation: `Specialists: txn ${specialists.transaction_risk}, device ${specialists.device_risk}, merchant ${specialists.merchant_context_risk}, behavior ${specialists.behavioral_pattern}. Derived velocity ${derived.velocity_score}, geo_mismatch ${derived.geo_mismatch}.`,
  };
}

export function heuristicAdjudicator(
  specialists: { transaction_risk: RiskLevel; device_risk: RiskLevel; merchant_context_risk: RiskLevel },
  merged: { risk_label: RiskLevel; recommended_action: string; explanation: string }
): AdjudicatorOut {
  const ranks = [
    specialists.transaction_risk,
    specialists.device_risk,
    specialists.merchant_context_risk,
    merged.risk_label,
  ].map((l) => ["LOW", "MEDIUM", "HIGH", "CRITICAL"].indexOf(l));
  const spread = Math.max(...ranks) - Math.min(...ranks);
  const disputed = spread >= 2;
  const validAction = ["ALLOW", "REVIEW", "STEP_UP_VERIFICATION", "HOLD", "REJECT"].includes(
    merged.recommended_action
  );
  const failures: string[] = [];
  if (!validAction) failures.push("adjudicator: recommended_action not in taxonomy");
  if (!merged.explanation || merged.explanation.length < 8) failures.push("adjudicator: explanation too thin");

  return {
    passed: failures.length === 0,
    failures,
    consensus: disputed ? "DISPUTED" : "AGREED",
    final_label: merged.risk_label,
    recommended_action: validAction
      ? (merged.recommended_action as AdjudicatorOut["recommended_action"])
      : "REVIEW",
    disagreement_reason: disputed
      ? "Specialist risk levels span two or more grades; human review required."
      : null,
  };
}
