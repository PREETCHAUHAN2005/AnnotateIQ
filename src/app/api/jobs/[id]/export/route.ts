import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/export?format=jsonl|json|csv — export the ML-ready dataset.
// Only rows where route='auto' OR reviewer_action IN ('accept','edit').
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
    return {
      ...p,
      concepts: Array.isArray(p.concepts) ? p.concepts.join("; ") : "",
      latex: Array.isArray(p.latex) ? p.latex.join("; ") : "",
      options: Array.isArray(p.options) ? p.options.join(" | ") : "",
      reviewed_by: f.reviewedBy ?? null,
      reviewer_action: f.reviewerAction ?? (f.route === "auto" ? "auto" : null),
    };
  });

  if (format === "json") {
    return NextResponse.json(
      { dataset: "annotateiq-jee-physics", count: rows.length, rows },
      { headers: { "Content-Disposition": `attachment; filename="${id}.json"` } }
    );
  }

  if (format === "csv") {
    const headers = [
      "unit_id", "seq", "stem", "chapter", "concepts", "difficulty", "bloom",
      "difficulty_rationale", "latex", "has_equation", "language", "code_mix_ratio",
      "confidence", "agreement", "route", "reviewer_action", "reviewed_by",
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map((h) => escape(r[h])).join(","));
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${id}.csv"`,
      },
    });
  }

  // JSONL (default)
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="${id}.jsonl"`,
    },
  });
}
