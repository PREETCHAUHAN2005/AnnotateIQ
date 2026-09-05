import { structuredComplete } from "@/lib/llm";
import {
  FAILURE_REASONS,
  parseAdjudicator,
  parseBehavioral,
  parseDeviceNetwork,
  parseFailureClassifier,
  parseFraudReasoning,
  parseMerchantOrder,
  parseRetryRouting,
  parseRingAnalyst,
  parseTransactionRisk,
  RETRYABILITY,
  RISK_FACTORS,
  ROUTING_IMPLICATIONS,
  type AdjudicatorOut,
  type BehavioralOut,
  type CanonicalPaymentEvent,
  type DerivedSignals,
  type DeviceNetworkOut,
  type FailureClassifierOut,
  type FailureReason,
  type FraudReasoningOut,
  type MerchantOrderOut,
  type RetryRoutingOut,
  type RingAnalystOut,
  type RiskLevel,
  type TransactionRiskOut,
} from "@/lib/schemas";
import {
  heuristicAdjudicator,
  heuristicAdjudicatorFailure,
  heuristicBehavioral,
  heuristicDeviceNetwork,
  heuristicFailureClassifier,
  heuristicFraudReasoning,
  heuristicMerchantOrder,
  heuristicRetryRouting,
  heuristicRingAnalyst,
  heuristicTransactionRisk,
} from "@/lib/heuristics";
import type { RingAssignment } from "@/lib/rings";

export type UnitInput = {
  unitId: string;
  event: CanonicalPaymentEvent;
  derived: DerivedSignals;
};

function eventBlock(event: CanonicalPaymentEvent, derived: DerivedSignals): string {
  return `Payment event (synthetic or public-shaped; not Razorpay production data):
${JSON.stringify(event, null, 2)}

Derived signals (deterministic, not a judgment):
${JSON.stringify(derived, null, 2)}

Return STRICT JSON only, no markdown.`;
}

export async function runTransactionRisk(
  unit: UnitInput
): Promise<{ value: TransactionRiskOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Transaction Risk Analyst for payment events.
Judge amount, time-of-day, payment method, and history only.
- "transaction_risk": LOW | MEDIUM | HIGH | CRITICAL
- "evidence": array of {feature, observation, impact: low|medium|high}

Return JSON: {"transaction_risk":"MEDIUM","evidence":[{"feature":"amount","observation":"24500","impact":"high"}]}`;
  return structuredComplete(sys, eventBlock(unit.event, unit.derived), parseTransactionRisk, {
    temperature: 0,
  });
}

export async function runBehavioral(
  unit: UnitInput
): Promise<{ value: BehavioralOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Behavioral Analyst for payment events.
Look at velocity, account age, failed attempts, refunds.
- "behavior_anomaly": boolean
- "behavioral_pattern": NONE | VELOCITY_ANOMALY | NEW_ACCOUNT_BURST | REPEAT_FAILURE | DORMANT_WAKE
- "evidence": {feature, observation, impact}[]

Return STRICT JSON.`;
  return structuredComplete(sys, eventBlock(unit.event, unit.derived), parseBehavioral, {
    temperature: 0,
  });
}

export async function runDeviceNetwork(
  unit: UnitInput
): Promise<{ value: DeviceNetworkOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Device & Network Analyst.
Look at device reuse, IP/billing/shipping mismatch, unusual device type.
- "device_risk": LOW | MEDIUM | HIGH | CRITICAL
- "evidence": {feature, observation, impact}[]

Return STRICT JSON.`;
  return structuredComplete(sys, eventBlock(unit.event, unit.derived), parseDeviceNetwork, {
    temperature: 0,
  });
}

export async function runMerchantOrder(
  unit: UnitInput
): Promise<{ value: MerchantOrderOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Merchant / Order Context Analyst.
Look at product category, order value vs amount, refunds, chargebacks.
- "merchant_context_risk": LOW | MEDIUM | HIGH | CRITICAL
- "evidence": {feature, observation, impact}[]

Return STRICT JSON.`;
  return structuredComplete(sys, eventBlock(unit.event, unit.derived), parseMerchantOrder, {
    temperature: 0,
  });
}

export type SpecialistPacket = {
  transaction_risk: RiskLevel;
  behavior_anomaly: boolean;
  behavioral_pattern: string;
  device_risk: RiskLevel;
  merchant_context_risk: RiskLevel;
};

export async function runFraudReasoning(
  unit: UnitInput,
  specialists: SpecialistPacket
): Promise<{ value: FraudReasoningOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Fraud Reasoning Agent. Combine specialist signals. Do not invent raw fields.
Allowed risk_factors (use only these plus "none_material"): ${RISK_FACTORS.join(", ")}.
- "risk_label": LOW | MEDIUM | HIGH | CRITICAL
- "recommended_action": ALLOW | REVIEW | STEP_UP_VERIFICATION | HOLD | REJECT
- "fraud_probability": 0..1
- "risk_factors": 1-8 strings
- "transaction_anomaly": boolean
- "chargeback_risk": LOW | MEDIUM | HIGH
- "explanation": 1-3 sentences citing event features

Return STRICT JSON.`;
  const user = `${eventBlock(unit.event, unit.derived)}

Specialist outputs:
${JSON.stringify(specialists)}`;
  return structuredComplete(sys, user, parseFraudReasoning, { temperature: 0.7 });
}

export async function runAdjudicator(
  unit: UnitInput,
  specialists: SpecialistPacket,
  merged: {
    risk_label: RiskLevel;
    recommended_action: string;
    explanation: string;
    risk_factors: string[];
  },
  failure?: { failure_reason: string; retryability: string }
): Promise<{ value: AdjudicatorOut | null; raw: string; latencyMs: number }> {
  const failureChecks = failure
    ? `
5. failure_reason must be one of: ${FAILURE_REASONS.join(" | ")}
6. retryability must be one of: ${RETRYABILITY.join(" | ")}
7. If gateway_message or decline_code clearly contradicts failure_reason, consensus MUST be DISPUTED`
    : "";
  const sys = `You are the Adjudicator. Judge only. Never invent a new transaction.
Checks:
1. risk_label is LOW|MEDIUM|HIGH|CRITICAL
2. recommended_action is ALLOW|REVIEW|STEP_UP_VERIFICATION|HOLD|REJECT
3. explanation cites at least one real feature from the event
4. If specialists include both LOW and HIGH/CRITICAL, consensus MUST be DISPUTED${failureChecks}

Return STRICT JSON:
{"passed":true,"failures":[],"consensus":"AGREED","final_label":"HIGH","recommended_action":"STEP_UP_VERIFICATION","disagreement_reason":null}`;
  const user = `${eventBlock(unit.event, unit.derived)}

Specialists: ${JSON.stringify(specialists)}
Merged proposal: ${JSON.stringify(merged)}${
    failure ? `\nFailure proposal: ${JSON.stringify(failure)}` : ""
  }`;
  return structuredComplete(sys, user, parseAdjudicator, { temperature: 0 });
}

export function fallbackTransactionRisk(event: CanonicalPaymentEvent, derived: DerivedSignals) {
  return heuristicTransactionRisk(event, derived);
}
export function fallbackBehavioral(event: CanonicalPaymentEvent, derived: DerivedSignals) {
  return heuristicBehavioral(event, derived);
}
export function fallbackDeviceNetwork(event: CanonicalPaymentEvent, derived: DerivedSignals) {
  return heuristicDeviceNetwork(event, derived);
}
export function fallbackMerchantOrder(event: CanonicalPaymentEvent, derived: DerivedSignals) {
  return heuristicMerchantOrder(event, derived);
}
export function fallbackFraudReasoning(
  event: CanonicalPaymentEvent,
  derived: DerivedSignals,
  specialists: SpecialistPacket,
  sampleIdx = 0
) {
  return heuristicFraudReasoning(event, derived, specialists, sampleIdx);
}
export function fallbackAdjudicator(
  specialists: SpecialistPacket,
  merged: { risk_label: RiskLevel; recommended_action: string; explanation: string }
) {
  return heuristicAdjudicator(specialists, merged);
}

export async function runRingAnalyst(
  unit: UnitInput,
  assignment: RingAssignment
): Promise<{ value: RingAnalystOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Ring Analyst. Judge a precomputed job-scoped entity graph. Never invent edges or a new cluster id.
- "network_risk": LOW | MEDIUM | HIGH | CRITICAL
- "relationship_confidence": 0..1
- "explanation": 1-2 sentences citing shared_entities already in the packet

If risk_cluster_id is null, network_risk must be LOW and confidence 0.`;
  const user = `${eventBlock(unit.event, unit.derived)}

Graph assignment (deterministic, do not invent members):
${JSON.stringify(assignment)}`;
  return structuredComplete(sys, user, parseRingAnalyst, { temperature: 0 });
}

export function fallbackRingAnalyst(assignment: RingAssignment) {
  return heuristicRingAnalyst(assignment);
}

export async function runFailureClassifier(
  unit: UnitInput
): Promise<{ value: FailureClassifierOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Failure Classifier. Judge only decline/timeout evidence. Do not set retryability.
- "failure_reason": ${FAILURE_REASONS.join(" | ")}
- "failure_severity": LOW | MEDIUM | HIGH | CRITICAL
- "evidence": {feature, observation, impact}[] citing decline_code and/or gateway_message

Return STRICT JSON.`;
  return structuredComplete(sys, eventBlock(unit.event, unit.derived), parseFailureClassifier, {
    temperature: 0,
  });
}

export async function runRetryRouting(
  unit: UnitInput,
  failure_reason: FailureReason
): Promise<{ value: RetryRoutingOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Retry / Routing Analyst. Judge only retryability and routing. Do not invent a new failure_reason.
- "retryability": ${RETRYABILITY.join(" | ")}
- "routing_implication": ${ROUTING_IMPLICATIONS.join(" | ")}
- "likely_resolution": customer_funds | retry_later | alternate_instrument | issuer_approval | merchant_config | none
- "customer_friction": none | low | medium | high
- "evidence": {feature, observation, impact}[]

Return STRICT JSON.`;
  const user = `${eventBlock(unit.event, unit.derived)}

Classified failure_reason (do not override): ${failure_reason}`;
  return structuredComplete(sys, user, parseRetryRouting, { temperature: 0 });
}

export function fallbackFailureClassifier(event: CanonicalPaymentEvent) {
  return heuristicFailureClassifier(event);
}
export function fallbackRetryRouting(event: CanonicalPaymentEvent, failure_reason: FailureReason) {
  return heuristicRetryRouting(event, failure_reason);
}
export function fallbackAdjudicatorFailure(
  event: CanonicalPaymentEvent,
  fail: FailureClassifierOut,
  retry: RetryRoutingOut
) {
  return heuristicAdjudicatorFailure(event, fail, retry);
}
