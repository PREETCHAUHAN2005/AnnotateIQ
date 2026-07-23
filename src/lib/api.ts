import type {
  Draft,
  FinalRecord,
  HoneypotResult,
  Job,
  JobComparison,
  QualityStats,
  ReviewItem,
  Unit,
} from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with automatic retry on network failure (server restarts, OOM kills).
 * The sandbox dev server gets killed under memory pressure; this makes the
 * frontend resilient by retrying transient failures instead of crashing.
 */
async function jfetch<T>(url: string, init?: RequestInit, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    } catch (e) {
      lastErr = e;
      // retry on network errors (Failed to fetch) and 5xx; don't retry on 4xx
      const isNetwork = e instanceof TypeError;
      const is5xx = e instanceof Error && /5\d\d:/.test(e.message);
      if ((isNetwork || is5xx) && attempt < retries) {
        await sleep(800 * (attempt + 1)); // 0.8s, 1.6s, 2.4s
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export const api = {
  listJobs: () => jfetch<{ jobs: Job[] }>("/api/jobs"),
  createJob: (body: { mode: "sample" | "paste"; paperId?: string; text?: string; filename?: string }) =>
    jfetch<{ job: Job }>("/api/jobs", { method: "POST", body: JSON.stringify(body) }),
  getJob: (id: string) => jfetch<{ job: Job }>(`/api/jobs/${id}`),
  getUnits: (id: string) => jfetch<{ units: (Unit & { final?: { route: string; confidence: number; agreement: number; reviewerAction: string | null } | null })[] }>(`/api/jobs/${id}/units`),
  runPipeline: (id: string) => jfetch<{ ok: boolean; job?: Job }>(`/api/jobs/${id}/run`, { method: "POST" }),
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
  getHoneypots: (id: string) => jfetch<{ honeypots: HoneypotResult[]; total: number }>(`/api/jobs/${id}/honeypots`),
  exportUrl: (id: string, format: "jsonl" | "json" | "csv" = "jsonl") => `/api/jobs/${id}/export?format=${format}`,
  compareJobs: () => jfetch<{ jobs: JobComparison[] }>("/api/compare"),
  deleteJob: (id: string) => jfetch<{ ok: boolean }>(`/api/jobs/${id}`, { method: "DELETE" }),
  resetJob: (id: string) => jfetch<{ ok: boolean }>(`/api/jobs/${id}/reset`, { method: "POST" }),
};
