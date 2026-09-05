// Shared types between frontend and backend API contracts.

export type JobStatus = "pending" | "extracting" | "labeling" | "review" | "done" | "failed";

export type JobKind = "risk" | "failure";

export type Job = {
  id: string;
  filename: string;
  source: string;
  kind?: JobKind;
  status: JobStatus;
  unitCount: number;
  autoCount: number;
  humanCount: number;
  reviewedCount: number;
  createdAt: string;
};

export type Unit = {
  id: string;
  jobId: string;
  seq: number;
  page: number;
  stem: string | null;
  rawText: string;
  optionsJson: string | null;
  isHoneypot: boolean;
  attempt: number;
  status: string;
  final?: FinalLite | null;
};

export type FinalLite = {
  route: "auto" | "human";
  confidence: number;
  agreement: number;
  reviewerAction: string | null;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RecommendedAction =
  | "ALLOW"
  | "REVIEW"
  | "STEP_UP_VERIFICATION"
  | "HOLD"
  | "REJECT";
export type Consensus = "AGREED" | "DISPUTED";

export type EvidenceItem = {
  feature: string;
  observation: string;
  impact: "low" | "medium" | "high";
  agent?: string;
  confidence?: number;
};

export type CanonicalPaymentEvent = {
  transaction_id: string;
  merchant_id?: string | null;
  customer_id?: string | null;
  timestamp?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  device_type?: string | null;
  device_id_hash?: string | null;
  ip_region?: string | null;
  billing_region?: string | null;
  shipping_region?: string | null;
  previous_transaction_count?: number | null;
  failed_attempts_1h?: number | null;
  refund_count_30d?: number | null;
  chargeback_history?: number | null;
  account_age?: number | null;
  order_value?: number | null;
  product_category?: string | null;
  payment_status?: string | null;
  decline_code?: string | null;
  gateway_message?: string | null;
};

export type DerivedSignals = {
  velocity_score: number;
  amount_anomaly: boolean;
  geo_mismatch: boolean;
  device_reuse_score: number;
  merchant_risk: number;
  customer_behavior_score: number;
};

export type UnitAnnotation = {
  unit_id: string;
  event: CanonicalPaymentEvent;
  derived: DerivedSignals;
  risk_label: RiskLevel;
  fraud_probability: number;
  risk_factors: string[];
  behavioral_pattern: string;
  transaction_anomaly: boolean;
  chargeback_risk: "LOW" | "MEDIUM" | "HIGH";
  recommended_action: RecommendedAction;
  evidence: EvidenceItem[];
  explanation: string;
  final_label: RiskLevel;
  final_score: number;
  confidence: number;
  agreement: number;
  consensus: Consensus;
  disagreement_reason: string | null;
  route: "auto" | "human";
  transaction_risk?: RiskLevel;
  behavior_anomaly?: boolean;
  device_risk?: RiskLevel;
  merchant_context_risk?: RiskLevel;
  risk_cluster_id?: string | null;
  network_risk?: RiskLevel;
  relationship_confidence?: number;
  shared_entities?: string[];
  cluster_size?: number;
  member_transaction_ids?: string[];
  failure_reason?: FailureReason;
  failure_severity?: RiskLevel;
  retryability?: Retryability;
  likely_resolution?: LikelyResolution;
  routing_implication?: RoutingImplication;
  customer_friction?: CustomerFriction;
};

export type FailureReason =
  | "insufficient_funds"
  | "issuer_decline"
  | "technical_failure"
  | "authentication_failure"
  | "network_failure"
  | "timeout"
  | "bank_downtime"
  | "configuration"
  | "unknown";

export type Retryability =
  | "do_not_retry"
  | "retry_same_rail"
  | "retry_alternate_route"
  | "retry_later"
  | "retry_with_step_up"
  | "contact_issuer"
  | "unknown";

export type RoutingImplication =
  | "stay_on_rail"
  | "switch_acquirer"
  | "switch_method"
  | "step_up_auth"
  | "block_retry"
  | "unknown";

export type LikelyResolution =
  | "customer_funds"
  | "retry_later"
  | "alternate_instrument"
  | "issuer_approval"
  | "merchant_config"
  | "none";

export type CustomerFriction = "none" | "low" | "medium" | "high";

export type AgentName =
  | "transaction_risk"
  | "behavioral"
  | "device_network"
  | "merchant_order"
  | "fraud_reasoning"
  | "adjudicator"
  | "ring_analyst"
  | "failure_classifier"
  | "retry_routing";

export type Draft = {
  id: string;
  agent: AgentName | string;
  sampleIdx: number;
  attempt: number;
  payload: Record<string, unknown>;
  latencyMs: number | null;
  createdAt: string;
};

export type FinalRecord = {
  id: string;
  unitId: string;
  seq: number;
  isHoneypot: boolean;
  payload: UnitAnnotation;
  confidence: number;
  agreement: number;
  route: "auto" | "human";
  reviewedBy: string | null;
  reviewerAction: "accept" | "edit" | "reject" | null;
  reviewNote: string | null;
};

export type ReviewItem = {
  id: string;
  unitId: string;
  seq: number;
  stem: string;
  options: string[] | null;
  isHoneypot: boolean;
  payload: UnitAnnotation;
  confidence: number;
  agreement: number;
  reviewerAction: string | null;
  reviewNote: string | null;
};

export type QualityStats = {
  job: { id: string; filename: string; status: string; unitCount: number };
  totals: {
    units: number;
    finals: number;
    auto: number;
    human: number;
    reviewed: number;
    honeypots: number;
  };
  rates: {
    autoRate: number;
    hoursSaved: number;
    manualMinutes: number;
    actualMinutes: number;
  };
  kappa: {
    risk_label: { value: number; label: string; tone: "good" | "warn" | "bad"; n: number };
    recommended_action: { value: number; label: string; tone: "good" | "warn" | "bad"; n: number };
  };
  honeypot: {
    perAgent: Record<string, { correct: number; total: number; accuracy: number }>;
    total: number;
    pass: number;
    fail: number;
  };
  events: Record<string, number>;
  distributions: {
    risk_label: Record<string, number>;
    recommended_action: Record<string, number>;
    chargeback_risk: Record<string, number>;
    consensus: Record<string, number>;
  };
  latency: Record<string, { avg: number; min: number; max: number; count: number; p95: number }>;
  confidenceBuckets: { label: string; count: number }[];
  avgConfByLabel: { label: string; avg: number; count: number }[];
};

export type PipelineEvent = {
  type: string;
  jobId: string;
  ts: number;
  data: Record<string, unknown>;
};

export type JobComparison = {
  id: string;
  filename: string;
  status: string;
  unitCount: number;
  finals: number;
  auto: number;
  human: number;
  reviewed: number;
  autoRate: number;
  avgConfidence: number;
  honeypots: number;
  honeypotPass: number;
  honeypotFail: number;
  honeypotAccuracy: number;
  kappaRisk: { value: number; label: string; tone: "good" | "warn" | "bad" };
  distRisk: Record<string, number>;
};

export type HoneypotDiff = {
  field: string;
  gold: string;
  predicted: string;
  match: boolean;
};

export type HoneypotResult = {
  unitId: string;
  seq: number;
  stem: string;
  isHoneypot: boolean;
  gold: Record<string, unknown> | null;
  predicted: Record<string, unknown> | null;
  confidence: number | null;
  route: "auto" | "human" | null;
  reviewerAction: string | null;
  event: { kind: string; detail: string | null } | null;
  diffs: HoneypotDiff[];
};

export type LabelStat = {
  name: string;
  count: number;
  autoCount: number;
  humanCount: number;
  avgConfidence: number;
  autoRate: number;
  actions: Record<string, number>;
  topFactors: { factor: string; count: number }[];
};

export type TaxonomyStats = {
  totalLabels: number;
  coveredLabels: number;
  totalEvents: number;
  labels: LabelStat[];
};

export type ActivityEvent = {
  id: string;
  type: string;
  jobId: string;
  unitId: string | null;
  seq: number | null;
  stem?: string | null;
  jobFilename?: string | null;
  kind: string;
  detail: string | null;
  createdAt: string;
};

export type SearchResult = {
  finalId: string;
  jobId: string;
  unitId: string;
  seq: number;
  isHoneypot: boolean;
  payload: UnitAnnotation;
  confidence: number;
  agreement: number;
  route: "auto" | "human";
  reviewerAction: string | null;
  matchedFields: string[];
};

export type JobTrend = {
  jobId: string;
  filename: string;
  createdAt: string;
  units: number;
  auto: number;
  human: number;
  reviewed: number;
  autoRate: number;
  avgConfidence: number;
  honeypotAccuracy: number;
  kappa: number;
  hoursSaved: number;
  cumulativeUnits: number;
  cumulativeAuto: number;
  cumulativeHuman: number;
  cumulativeHours: number;
};

export type InsightsStats = {
  summary: {
    totalJobs: number;
    totalUnits: number;
    totalAuto: number;
    totalHuman: number;
    overallAutoRate: number;
    overallAvgConf: number;
    totalHoursSaved: number;
  };
  trends: JobTrend[];
  distributions: {
    risk_label: Record<string, number>;
    recommended_action: Record<string, number>;
    consensus: Record<string, number>;
  };
};

export type IeeeDatasetInfo = {
  available: boolean;
  path: string;
  count: number;
  message: string;
  identityAvailable?: boolean;
  identityPath?: string;
  identityCount?: number;
  fraudGoldCount?: number;
};
