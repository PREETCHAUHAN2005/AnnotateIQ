import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=xxx — search across all finals by stem/chapter/concept/difficulty
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
        stem: string;
        chapter: string;
        concepts: string[];
        difficulty: string;
        bloom: string;
        language: string;
        latex: string[];
      };
      const haystack = [
        p.stem,
        p.chapter,
        p.concepts.join(" "),
        p.difficulty,
        p.bloom,
        p.language,
        p.latex.join(" "),
      ].join(" ").toLowerCase();

      const matches = q.split(/\s+/).every((token) => haystack.includes(token));

      if (!matches) return null;

      // highlight which field matched
      const matchedFields: string[] = [];
      if (p.stem.toLowerCase().includes(q)) matchedFields.push("stem");
      if (p.chapter.toLowerCase().includes(q)) matchedFields.push("chapter");
      if (p.concepts.some((c) => c.toLowerCase().includes(q))) matchedFields.push("concepts");
      if (p.difficulty.toLowerCase().includes(q)) matchedFields.push("difficulty");
      if (p.bloom.toLowerCase().includes(q)) matchedFields.push("bloom");
      if (p.latex.some((l) => l.toLowerCase().includes(q))) matchedFields.push("latex");

      return {
        finalId: f.id,
        jobId: f.jobId,
        unitId: f.unitId,
        seq: f.unit.seq,
        isHoneypot: f.unit.isHoneypot,
        filename: f.unit.jobId ? undefined : undefined, // job filename fetched separately if needed
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

  return NextResponse.json({
    results,
    total: results.length,
    query: q,
  });
}
