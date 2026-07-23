import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHAPTERS } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/taxonomy — aggregate chapter stats across all jobs
export async function GET() {
  const finals = await db.final.findMany({ include: { unit: true } });

  // per-chapter stats
  const chapterStats: Record<string, {
    count: number;
    autoCount: number;
    humanCount: number;
    avgConfidence: number;
    difficulties: Record<string, number>;
    blooms: Record<string, number>;
    concepts: Record<string, number>;
  }> = {};

  for (const f of finals) {
    const p = JSON.parse(f.payload) as {
      chapter: string;
      difficulty: string;
      bloom: string;
      concepts: string[];
      confidence: number;
    };
    if (!chapterStats[p.chapter]) {
      chapterStats[p.chapter] = {
        count: 0,
        autoCount: 0,
        humanCount: 0,
        avgConfidence: 0,
        difficulties: {},
        blooms: {},
        concepts: {},
      };
    }
    const s = chapterStats[p.chapter];
    s.count++;
    if (f.route === "auto") s.autoCount++;
    else s.humanCount++;
    s.avgConfidence += p.confidence;
    s.difficulties[p.difficulty] = (s.difficulties[p.difficulty] ?? 0) + 1;
    s.blooms[p.bloom] = (s.blooms[p.bloom] ?? 0) + 1;
    for (const c of p.concepts) {
      s.concepts[c] = (s.concepts[c] ?? 0) + 1;
    }
  }

  // finalize averages + build the full list (including chapters with 0 questions)
  const chapters = CHAPTERS.map((name) => {
    const s = chapterStats[name];
    if (!s) {
      return {
        name,
        count: 0,
        autoCount: 0,
        humanCount: 0,
        avgConfidence: 0,
        autoRate: 0,
        difficulties: { easy: 0, medium: 0, hard: 0 },
        blooms: { remember: 0, understand: 0, apply: 0, analyze: 0 },
        topConcepts: [],
      };
    }
    return {
      name,
      count: s.count,
      autoCount: s.autoCount,
      humanCount: s.humanCount,
      avgConfidence: s.count > 0 ? s.avgConfidence / s.count : 0,
      autoRate: s.count > 0 ? s.autoCount / s.count : 0,
      difficulties: s.difficulties,
      blooms: s.blooms,
      topConcepts: Object.entries(s.concepts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([concept, count]) => ({ concept, count })),
    };
  });

  const totalQuestions = finals.length;
  const coveredChapters = chapters.filter((c) => c.count > 0).length;

  return NextResponse.json({
    totalChapters: CHAPTERS.length,
    coveredChapters,
    totalQuestions,
    chapters: chapters.sort((a, b) => b.count - a.count),
  });
}
