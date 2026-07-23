// Shared types between frontend and backend API contracts.

export type JobStatus = "pending" | "extracting" | "labeling" | "review" | "done" | "failed";

export type Job = {
  id: string;
  filename: string;
  source: string;
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

export type UnitAnnotation = {
  unit_id: string;
  stem: string;
  options: string[] | null;
  subject: "physics";
  chapter: string;
  concepts: string[];
  difficulty: "easy" | "medium" | "hard";
  bloom: "remember" | "understand" | "apply" | "analyze";
  difficulty_rationale: string;
  latex: string[];
  has_equation: boolean;
  language: "en" | "hi" | "hinglish";
  code_mix_ratio: number;
  confidence: number;
  agreement: number;
  route: "auto" | "human";
};

export type Draft = {
  id: string;
  agent: "taxonomy" | "difficulty" | "math" | "language" | "critic";
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
    chapter: { value: number; label: string; tone: "good" | "warn" | "bad"; n: number };
    difficulty: { value: number; label: string; tone: "good" | "warn" | "bad"; n: number };
  };
  honeypot: {
    perAgent: Record<string, { correct: number; total: number; accuracy: number }>;
    total: number;
    pass: number;
    fail: number;
  };
  events: Record<string, number>;
  distributions: {
    difficulty: Record<string, number>;
    chapter: Record<string, number>;
    bloom: Record<string, number>;
    language: Record<string, number>;
  };
  latency: Record<string, { avg: number; min: number; max: number; count: number; p95: number }>;
  confidenceBuckets: { label: string; count: number }[];
  avgConfByChapter: { chapter: string; avg: number; count: number }[];
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
  kappaChapter: { value: number; label: string; tone: "good" | "warn" | "bad" };
  distDifficulty: Record<string, number>;
};
