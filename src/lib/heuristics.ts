import type {
  AdjudicatorOut,
  BehavioralOut,
  CanonicalPaymentEvent,
  DerivedSignals,
  DeviceNetworkOut,
  FailureClassifierOut,
  FailureReason,
  FraudReasoningOut,
  MerchantOrderOut,
  RetryRoutingOut,
  RingAnalystOut,
  RiskLevel,
  TransactionRiskOut,
} from "@/lib/schemas";
import type { RingAssignment } from "@/lib/rings";

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

export function heuristicRingAnalyst(assignment: RingAssignment): RingAnalystOut {
  if (!assignment.risk_cluster_id) {
    return {
      network_risk: "LOW",
      relationship_confidence: 0,
      explanation: "No multi-customer shared-device cluster in this job.",
    };
  }
  const members = assignment.member_transaction_ids.join(", ");
  return {
    network_risk: assignment.network_risk,
    relationship_confidence: assignment.relationship_confidence,
    explanation: `${assignment.risk_cluster_id} links ${assignment.cluster_size} events (${members}) via ${assignment.shared_entities.join(", ") || "shared entities"}. Edges come from the job graph — not invented.`,
  };
}

const CODE_REASON: Record<string, FailureReason> = {
  "51": "insufficient_funds",
  "116": "insufficient_funds",
  "05": "issuer_decline",
  "04": "issuer_decline",
  "41": "issuer_decline",
  "91": "timeout",
  "96": "technical_failure",
  "68": "timeout",
  N7: "authentication_failure",
  "1A": "authentication_failure",
  "65": "authentication_failure",
  "12": "configuration",
  "30": "configuration",
  "92": "network_failure",
  "15": "network_failure",
};

const SEVERITY: Record<FailureReason, RiskLevel> = {
  insufficient_funds: "MEDIUM",
  issuer_decline: "HIGH",
  technical_failure: "MEDIUM",
  authentication_failure: "MEDIUM",
  network_failure: "HIGH",
  timeout: "HIGH",
  bank_downtime: "HIGH",
  configuration: "LOW",
  unknown: "MEDIUM",
};

function classifyFailureReason(event: CanonicalPaymentEvent): FailureReason {
  const code = (event.decline_code ?? "").trim().toUpperCase();
  const msg = (event.gateway_message ?? "").toLowerCase();
  if (/downtime|unavailable|bank down/.test(msg)) return "bank_downtime";
  if (/insufficient|not sufficient|nsf/.test(msg)) return "insufficient_funds";
  if (/3ds|authenticat|sca |step.?up|cvv/.test(msg)) return "authentication_failure";
  if (/do not honor|stolen|pickup|pick up/.test(msg)) return "issuer_decline";
  if (/unable to route|network/.test(msg)) return "network_failure";
  if (/config|invalid transaction/.test(msg)) return "configuration";
  if (/timeout|timed out|too late/.test(msg)) return "timeout";
  if (/malfunction|system error|technical/.test(msg)) return "technical_failure";
  return CODE_REASON[code] ?? "unknown";
}

export function heuristicFailureClassifier(event: CanonicalPaymentEvent): FailureClassifierOut {
  const failure_reason = classifyFailureReason(event);
  const code = event.decline_code ?? "none";
  const msg = event.gateway_message ?? event.payment_status ?? "no gateway message";
  return {
    failure_reason,
    failure_severity: SEVERITY[failure_reason],
    evidence: [
      {
        feature: "decline_code",
        observation: String(code),
        impact: failure_reason === "unknown" ? "low" : "high",
        agent: "failure_classifier",
      },
      {
        feature: "gateway_message",
        observation: String(msg),
        impact: "medium",
        agent: "failure_classifier",
      },
    ],
  };
}

const RETRY_FOR_REASON: Record<
  FailureReason,
  Pick<RetryRoutingOut, "retryability" | "routing_implication" | "likely_resolution" | "customer_friction">
> = {
  insufficient_funds: {
    retryability: "retry_later",
    routing_implication: "stay_on_rail",
    likely_resolution: "customer_funds",
    customer_friction: "high",
  },
  issuer_decline: {
    retryability: "do_not_retry",
    routing_implication: "block_retry",
    likely_resolution: "none",
    customer_friction: "high",
  },
  technical_failure: {
    retryability: "retry_later",
    routing_implication: "stay_on_rail",
    likely_resolution: "retry_later",
    customer_friction: "low",
  },
  authentication_failure: {
    retryability: "retry_with_step_up",
    routing_implication: "step_up_auth",
    likely_resolution: "issuer_approval",
    customer_friction: "medium",
  },
  network_failure: {
    retryability: "retry_alternate_route",
    routing_implication: "switch_acquirer",
    likely_resolution: "retry_later",
    customer_friction: "low",
  },
  timeout: {
    retryability: "retry_later",
    routing_implication: "switch_acquirer",
    likely_resolution: "retry_later",
    customer_friction: "medium",
  },
  bank_downtime: {
    retryability: "retry_later",
    routing_implication: "switch_acquirer",
    likely_resolution: "retry_later",
    customer_friction: "medium",
  },
  configuration: {
    retryability: "do_not_retry",
    routing_implication: "stay_on_rail",
    likely_resolution: "merchant_config",
    customer_friction: "low",
  },
  unknown: {
    retryability: "unknown",
    routing_implication: "unknown",
    likely_resolution: "none",
    customer_friction: "medium",
  },
};

export function heuristicRetryRouting(
  event: CanonicalPaymentEvent,
  failure_reason: FailureReason
): RetryRoutingOut {
  const mapped = RETRY_FOR_REASON[failure_reason];
  return {
    ...mapped,
    evidence: [
      {
        feature: "failure_reason",
        observation: failure_reason,
        impact: mapped.retryability === "do_not_retry" ? "high" : "medium",
        agent: "retry_routing",
      },
      {
        feature: "decline_code",
        observation: event.decline_code ?? "none",
        impact: "low",
        agent: "retry_routing",
      },
    ],
  };
}

export function heuristicAdjudicatorFailure(
  event: CanonicalPaymentEvent,
  fail: FailureClassifierOut,
  retry: RetryRoutingOut
): { passed: boolean; failures: string[]; disputed: boolean; disagreement_reason: string | null } {
  const failures: string[] = [];
  if (!fail.failure_reason) failures.push("adjudicator: failure_reason missing");
  if (!retry.retryability) failures.push("adjudicator: retryability missing");
  if (!fail.evidence.length) failures.push("adjudicator: failure evidence missing");
  if (!retry.evidence.length) failures.push("adjudicator: retry evidence missing");

  const msg = (event.gateway_message ?? "").toLowerCase();
  const code = (event.decline_code ?? "").toUpperCase();
  let disputed = false;
  let disagreement_reason: string | null = null;

  const fundsCue = /insufficient|nsf/.test(msg) || code === "51" || code === "116";
  const timeoutCue = /timeout|timed out|too late/.test(msg) || code === "91" || code === "68";
  const authCue = /3ds|authenticat|sca |step.?up|cvv/.test(msg) || code === "N7" || code === "1A" || code === "65";

  if (fail.failure_reason === "timeout" && fundsCue) {
    disputed = true;
    disagreement_reason = "failure_reason timeout contradicts insufficient-funds cues.";
  } else if (fail.failure_reason === "insufficient_funds" && timeoutCue && !fundsCue) {
    disputed = true;
    disagreement_reason = "failure_reason insufficient_funds contradicts timeout cues.";
  } else if (fail.failure_reason === "authentication_failure" && fundsCue && !authCue) {
    disputed = true;
    disagreement_reason = "failure_reason authentication_failure contradicts funds cues.";
  } else if (fail.failure_reason === "issuer_decline" && (timeoutCue || fundsCue) && !/do not honor|stolen/.test(msg)) {
    disputed = true;
    disagreement_reason = "failure_reason issuer_decline contradicts timeout/funds cues.";
  }

  return {
    passed: failures.length === 0,
    failures,
    disputed,
    disagreement_reason,
  };
}
