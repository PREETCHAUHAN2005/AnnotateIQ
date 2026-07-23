import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/export?format=jsonl|json — export the ML-ready dataset.
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

  // JSONL
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="${id}.jsonl"`,
    },
  });
}
