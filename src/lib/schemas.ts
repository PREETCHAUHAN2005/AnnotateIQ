import { z } from "zod";
import taxonomy from "@/lib/data/taxonomy.json";

export const RISK_LABELS = taxonomy.risk_labels as readonly string[];
export const ACTIONS = taxonomy.actions as readonly string[];
export const RISK_FACTORS = taxonomy.risk_factors as readonly string[];
export const BEHAVIORAL_PATTERNS = taxonomy.behavioral_patterns as readonly string[];
export const CHARGEBACK_LEVELS = taxonomy.chargeback_levels as readonly string[];

export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const RecommendedAction = z.enum([
  "ALLOW",
  "REVIEW",
  "STEP_UP_VERIFICATION",
  "HOLD",
  "REJECT",
]);
export type RecommendedAction = z.infer<typeof RecommendedAction>;

export const Consensus = z.enum(["AGREED", "DISPUTED"]);
export type Consensus = z.infer<typeof Consensus>;

export const Impact = z.enum(["low", "medium", "high"]);

export const EvidenceItem = z.object({
  feature: z.string(),
  observation: z.string(),
  impact: Impact,
  agent: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const CanonicalPaymentEvent = z.object({
  transaction_id: z.string(),
  merchant_id: z.string().nullable().optional(),
  customer_id: z.string().nullable().optional(),
  timestamp: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  device_type: z.string().nullable().optional(),
  device_id_hash: z.string().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  billing_region: z.string().nullable().optional(),
  shipping_region: z.string().nullable().optional(),
  previous_transaction_count: z.number().nullable().optional(),
  failed_attempts_1h: z.number().nullable().optional(),
  refund_count_30d: z.number().nullable().optional(),
  chargeback_history: z.number().nullable().optional(),
  account_age: z.number().nullable().optional(),
  order_value: z.number().nullable().optional(),
  product_category: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
});
export type CanonicalPaymentEvent = z.infer<typeof CanonicalPaymentEvent>;

export const DerivedSignals = z.object({
  velocity_score: z.number(),
  amount_anomaly: z.boolean(),
  geo_mismatch: z.boolean(),
  device_reuse_score: z.number(),
  merchant_risk: z.number(),
  customer_behavior_score: z.number(),
});
export type DerivedSignals = z.infer<typeof DerivedSignals>;

export const TransactionRiskOut = z.object({
  transaction_risk: RiskLevel,
  evidence: z.array(EvidenceItem).default([]),
});
export type TransactionRiskOut = z.infer<typeof TransactionRiskOut>;

export const BehavioralOut = z.object({
  behavior_anomaly: z.boolean(),
  behavioral_pattern: z.string(),
  evidence: z.array(EvidenceItem).default([]),
});
export type BehavioralOut = z.infer<typeof BehavioralOut>;

export const DeviceNetworkOut = z.object({
  device_risk: RiskLevel,
  evidence: z.array(EvidenceItem).default([]),
});
export type DeviceNetworkOut = z.infer<typeof DeviceNetworkOut>;

export const MerchantOrderOut = z.object({
  merchant_context_risk: RiskLevel,
  evidence: z.array(EvidenceItem).default([]),
});
export type MerchantOrderOut = z.infer<typeof MerchantOrderOut>;

export const FraudReasoningOut = z.object({
  risk_label: RiskLevel,
  recommended_action: RecommendedAction,
  fraud_probability: z.number().min(0).max(1),
  risk_factors: z.array(z.string()).min(1).max(8),
  transaction_anomaly: z.boolean(),
  chargeback_risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  explanation: z.string().min(1),
});
export type FraudReasoningOut = z.infer<typeof FraudReasoningOut>;

export const AdjudicatorOut = z.object({
  passed: z.boolean(),
  failures: z.array(z.string()).default([]),
  consensus: Consensus,
  final_label: RiskLevel,
  recommended_action: RecommendedAction,
  disagreement_reason: z.string().nullable().default(null),
});
export type AdjudicatorOut = z.infer<typeof AdjudicatorOut>;

export const RingAnalystOut = z.object({
  network_risk: RiskLevel,
  relationship_confidence: z.number().min(0).max(1),
  explanation: z.string().min(1),
});
export type RingAnalystOut = z.infer<typeof RingAnalystOut>;

export const UnitAnnotation = z.object({
  unit_id: z.string(),
  event: CanonicalPaymentEvent,
  derived: DerivedSignals,
  risk_label: RiskLevel,
  fraud_probability: z.number(),
  risk_factors: z.array(z.string()),
  behavioral_pattern: z.string(),
  transaction_anomaly: z.boolean(),
  chargeback_risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  recommended_action: RecommendedAction,
  evidence: z.array(EvidenceItem),
  explanation: z.string(),
  final_label: RiskLevel,
  final_score: z.number(),
  confidence: z.number(),
  agreement: z.number(),
  consensus: Consensus,
  disagreement_reason: z.string().nullable(),
  route: z.enum(["auto", "human"]),
  transaction_risk: RiskLevel.optional(),
  behavior_anomaly: z.boolean().optional(),
  device_risk: RiskLevel.optional(),
  merchant_context_risk: RiskLevel.optional(),
  risk_cluster_id: z.string().nullable().optional(),
  network_risk: RiskLevel.optional(),
  relationship_confidence: z.number().min(0).max(1).optional(),
  shared_entities: z.array(z.string()).optional(),
  cluster_size: z.number().int().min(1).optional(),
  member_transaction_ids: z.array(z.string()).optional(),
});
export type UnitAnnotation = z.infer<typeof UnitAnnotation>;

export const GoldRisk = z.object({
  risk_label: RiskLevel,
  recommended_action: RecommendedAction,
  risk_cluster_id: z.string().nullable().optional(),
});
export type GoldRisk = z.infer<typeof GoldRisk>;

export function parseTransactionRisk(raw: unknown): TransactionRiskOut {
  return TransactionRiskOut.parse(raw);
}
export function parseBehavioral(raw: unknown): BehavioralOut {
  return BehavioralOut.parse(raw);
}
export function parseDeviceNetwork(raw: unknown): DeviceNetworkOut {
  return DeviceNetworkOut.parse(raw);
}
export function parseMerchantOrder(raw: unknown): MerchantOrderOut {
  return MerchantOrderOut.parse(raw);
}
export function parseFraudReasoning(raw: unknown): FraudReasoningOut {
  return FraudReasoningOut.parse(raw);
}
export function parseAdjudicator(raw: unknown): AdjudicatorOut {
  return AdjudicatorOut.parse(raw);
}
export function parseRingAnalyst(raw: unknown): RingAnalystOut {
  return RingAnalystOut.parse(raw);
}

export function parseTaxonomy(raw: unknown): TransactionRiskOut {
  return parseTransactionRisk(raw);
}
export function parseDifficulty(raw: unknown): BehavioralOut {
  return parseBehavioral(raw);
}
export function parseMath(raw: unknown): DeviceNetworkOut {
  return parseDeviceNetwork(raw);
}
export function parseLanguage(raw: unknown): MerchantOrderOut {
  return parseMerchantOrder(raw);
}
export function parseCritic(raw: unknown): AdjudicatorOut {
  return parseAdjudicator(raw);
}
