import { NextRequest, NextResponse } from "next/server";

/** Slightly above the 1.5 MB ingest cap so the JSON wrapper still fits. */
export const MAX_REQUEST_BYTES = 1_600_000;

export const RATE_JOBS_CREATE = 10;
export const RATE_JOBS_RUN = 5;
export const RATE_JOBS_MUTATE = 10;
export const RATE_SEARCH = 30;
export const RATE_REVIEW = 30;
export const RATE_WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

export function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs = RATE_WINDOW_MS
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0]! + windowMs - now) / 1000));
    hits.set(key, recent);
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

export function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number
): NextResponse | null {
  const result = rateLimit(`${bucket}:${clientKey(req)}`, limit);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}

export async function readJsonBody(
  req: NextRequest
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > MAX_REQUEST_BYTES) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request too large" }, { status: 413 }),
      };
    }
  }

  const text = await req.text();
  if (text.length > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request too large" }, { status: 413 }),
    };
  }
  if (!text.trim()) return { ok: true, body: {} };

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
