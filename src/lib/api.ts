import type {
  Draft,
  FinalRecord,
  Job,
  QualityStats,
  ReviewItem,
  Unit,
} from "@/lib/types";

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listJobs: () => jfetch<{ jobs: Job[] }>("/api/jobs"),
  createJob: (body: { mode: "sample" | "paste"; paperId?: string; text?: string; filename?: string }) =>
    jfetch<{ job: Job }>("/api/jobs", { method: "POST", body: JSON.stringify(body) }),
  getJob: (id: string) => jfetch<{ job: Job }>(`/api/jobs/${id}`),
  getUnits: (id: string) => jfetch<{ units: (Unit & { final?: { route: string; confidence: number; agreement: number; reviewerAction: string | null } | null })[] }>(`/api/jobs/${id}/units`),
  runPipeline: (id: string) => jfetch<{ ok: boolean }>(`/api/jobs/${id}/run`, { method: "POST" }),
  getFinals: (id: string) => jfetch<{ finals: FinalRecord[] }>(`/api/jobs/${id}/finals`),
  getDrafts: (jobId: string, unitId: string) =>
    jfetch<{
      unit: { id: string; seq: number; stem: string; options: string[] | null; isHoneypot: boolean; goldPayload: Record<string, unknown> | null; attempt: number } | null;
      drafts: Draft[];
      final: { payload: unknown; confidence: number; agreement: number; route: string; reviewedBy: string | null; reviewerAction: string | null } | null;
    }>(`/api/jobs/${jobId}/drafts/${unitId}`),
  getReviewQueue: (id: string, unreviewed = false) =>
    jfetch<{ queue: ReviewItem[]; total: number; reviewed: number }>(
      `/api/jobs/${id}/review${unreviewed ? "?unreviewed=1" : ""}`
    ),
  submitReview: (unitId: string, body: { action: "accept" | "edit" | "reject"; editedPayload?: unknown; note?: string; reviewer?: string }) =>
    jfetch<{ ok: boolean }>(`/api/units/${unitId}/review`, { method: "POST", body: JSON.stringify(body) }),
  getQuality: (id: string) => jfetch<QualityStats>(`/api/jobs/${id}/quality`),
  exportUrl: (id: string, format: "jsonl" | "json" = "jsonl") => `/api/jobs/${id}/export?format=${format}`,
};
