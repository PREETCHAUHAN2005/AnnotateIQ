import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") ?? "jsonl";

  const finals = await db.final.findMany({
    where: { jobId: id },
    include: { unit: true },
    orderBy: { unit: { seq: "asc" } },
  });

  const eligible = finals.filter(
    (f) => f.route === "auto" || f.reviewerAction === "accept" || f.reviewerAction === "edit"
  );

  const rows = eligible.map((f) => {
    const p = JSON.parse(f.payload);
    const event = p.event ?? {};
    return {
      ...p,
      unit_id: p.unit_id ?? f.unitId,
      seq: f.unit.seq,
      transaction_id: event.transaction_id,
      amount: event.amount,
      merchant_id: event.merchant_id,
      risk_factors: Array.isArray(p.risk_factors) ? p.risk_factors.join("; ") : "",
      evidence_count: Array.isArray(p.evidence) ? p.evidence.length : 0,
      reviewed_by: f.reviewedBy ?? null,
      reviewer_action: f.reviewerAction ?? (f.route === "auto" ? "auto" : null),
    };
  });

  if (format === "json") {
    return NextResponse.json(
      { dataset: "annotateiq-payment-risk", count: rows.length, rows },
      { headers: { "Content-Disposition": `attachment; filename="${id}.json"` } }
    );
  }

  if (format === "csv") {
    const headers = [
      "unit_id",
      "seq",
      "transaction_id",
      "amount",
      "merchant_id",
      "risk_label",
      "final_label",
      "recommended_action",
      "fraud_probability",
      "chargeback_risk",
      "behavioral_pattern",
      "risk_factors",
      "consensus",
      "confidence",
      "agreement",
      "route",
      "reviewer_action",
      "reviewed_by",
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map((h) => escape((r as Record<string, unknown>)[h])).join(","));
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${id}.csv"`,
      },
    });
  }

  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="${id}.jsonl"`,
    },
  });
}
