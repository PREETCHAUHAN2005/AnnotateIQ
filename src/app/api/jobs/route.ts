import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createJobFromSample, createJobFromText } from "@/lib/ingest";
import { SAMPLE_PAPERS } from "@/lib/data/sample-papers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await db.job.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let jobId: string;
    let filename: string;

    if (body.mode === "sample") {
      const paper = SAMPLE_PAPERS.find((p) => p.id === body.paperId) ?? SAMPLE_PAPERS[0];
      jobId = await createJobFromSample(paper.id);
      filename = paper.filename;
    } else if (body.mode === "paste") {
      const text = String(body.text ?? "");
      filename = String(body.filename ?? "pasted-paper.txt");
      if (text.trim().length < 10) {
        return NextResponse.json({ error: "Text too short" }, { status: 400 });
      }
      jobId = await createJobFromText(filename, text);
    } else {
      jobId = await createJobFromSample(SAMPLE_PAPERS[0].id);
      filename = SAMPLE_PAPERS[0].filename;
    }

    void filename;
    const job = await db.job.findUnique({ where: { id: jobId } });
    return NextResponse.json({ job });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const clientError =
      message.includes("No questions found") ||
      message.includes("Text too short") ||
      message.includes("Unknown sample");
    return NextResponse.json(
      { error: message },
      { status: clientError ? 400 : 500 }
    );
  }
}
