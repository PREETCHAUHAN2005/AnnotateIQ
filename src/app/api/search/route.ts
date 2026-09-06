import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, RATE_SEARCH } from "@/lib/http-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_WINDOW = 500;

type SearchPayload = {
  event?: {
    transaction_id?: string;
    merchant_id?: string;
    amount?: number;
    decline_code?: string;
    gateway_message?: string;
  };
  risk_label?: string;
  recommended_action?: string;
  risk_factors?: string[];
  explanation?: string;
  behavioral_pattern?: string;
  risk_cluster_id?: string | null;
  shared_entities?: string[];
  member_transaction_ids?: string[];
  failure_reason?: string;
  retryability?: string;
};

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, "search", RATE_SEARCH);
  if (limited) return limited;

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0, query: q });
  }

  const finals = await db.final.findMany({
    include: { unit: true },
    orderBy: { createdAt: "desc" },
    take: SEARCH_WINDOW,
  });

  const results = finals
    .map((f) => {
      let p: SearchPayload;
      try {
        p = JSON.parse(f.payload) as SearchPayload;
      } catch {
        return null;
      }
      const haystack = [
        p.event?.transaction_id,
        p.event?.merchant_id,
        p.event?.amount,
        p.event?.decline_code,
        p.event?.gateway_message,
        p.risk_label,
        p.recommended_action,
        (p.risk_factors ?? []).join(" "),
        p.explanation,
        p.behavioral_pattern,
        p.risk_cluster_id,
        (p.shared_entities ?? []).join(" "),
        (p.member_transaction_ids ?? []).join(" "),
        p.failure_reason,
        p.retryability,
      ]
        .join(" ")
        .toLowerCase();

      if (!q.split(/\s+/).every((token) => haystack.includes(token))) return null;

      const matchedFields: string[] = [];
      if ((p.event?.transaction_id ?? "").toLowerCase().includes(q)) matchedFields.push("transaction_id");
      if ((p.event?.merchant_id ?? "").toLowerCase().includes(q)) matchedFields.push("merchant_id");
      if ((p.risk_label ?? "").toLowerCase().includes(q)) matchedFields.push("risk_label");
      if ((p.recommended_action ?? "").toLowerCase().includes(q)) matchedFields.push("recommended_action");
      if ((p.risk_factors ?? []).some((c) => c.toLowerCase().includes(q))) matchedFields.push("risk_factors");
      if ((p.explanation ?? "").toLowerCase().includes(q)) matchedFields.push("explanation");
      if ((p.risk_cluster_id ?? "").toLowerCase().includes(q)) matchedFields.push("risk_cluster_id");
      if ((p.failure_reason ?? "").toLowerCase().includes(q)) matchedFields.push("failure_reason");
      if ((p.retryability ?? "").toLowerCase().includes(q)) matchedFields.push("retryability");

      return {
        finalId: f.id,
        jobId: f.jobId,
        unitId: f.unitId,
        seq: f.unit.seq,
        isHoneypot: f.unit.isHoneypot,
        payload: p,
        confidence: f.confidence,
        agreement: f.agreement,
        route: f.route,
        reviewerAction: f.reviewerAction,
        matchedFields,
      };
    })
    .filter(Boolean)
    .slice(0, 50);

  return NextResponse.json({ results, total: results.length, query: q });
}
