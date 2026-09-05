import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0, query: q });
  }

  const finals = await db.final.findMany({
    include: { unit: true },
    orderBy: { unit: { seq: "asc" } },
  });

  const results = finals
    .map((f) => {
      const p = JSON.parse(f.payload) as {
        event?: { transaction_id?: string; merchant_id?: string; amount?: number };
        risk_label?: string;
        recommended_action?: string;
        risk_factors?: string[];
        explanation?: string;
        behavioral_pattern?: string;
        risk_cluster_id?: string | null;
        shared_entities?: string[];
        member_transaction_ids?: string[];
      };
      const haystack = [
        p.event?.transaction_id,
        p.event?.merchant_id,
        p.event?.amount,
        p.risk_label,
        p.recommended_action,
        (p.risk_factors ?? []).join(" "),
        p.explanation,
        p.behavioral_pattern,
        p.risk_cluster_id,
        (p.shared_entities ?? []).join(" "),
        (p.member_transaction_ids ?? []).join(" "),
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
