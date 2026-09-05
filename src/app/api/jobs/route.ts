import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createJobFromIeee, createJobFromSample, createJobFromText } from "@/lib/ingest";
import { SAMPLE_BATCHES } from "@/lib/data/sample-transactions";
import { getIeeeDatasetInfo } from "@/lib/ieee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await db.job.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ jobs, ieee: getIeeeDatasetInfo() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let jobId: string;

    if (body.mode === "sample") {
      const pack = SAMPLE_BATCHES.find((p) => p.id === body.packId) ?? SAMPLE_BATCHES[0];
      jobId = await createJobFromSample(pack.id);
    } else if (body.mode === "paste") {
      const text = String(body.text ?? "");
      const filename = String(body.filename ?? "pasted-events.json");
      if (text.trim().length < 2) {
        return NextResponse.json({ error: "Paste JSON or CSV of payment events." }, { status: 400 });
      }
      jobId = await createJobFromText(filename, text);
    } else if (body.mode === "ieee") {
      const info = getIeeeDatasetInfo();
      if (!info.available) {
        return NextResponse.json({ error: info.message }, { status: 400 });
      }
      jobId = await createJobFromIeee();
    } else {
      jobId = await createJobFromSample(SAMPLE_BATCHES[0].id);
    }

    const job = await db.job.findUnique({ where: { id: jobId } });
    return NextResponse.json({ job });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const clientError =
      message.includes("No payment events") ||
      message.includes("too short") ||
      message.includes("JSON") ||
      message.includes("CSV") ||
      message.includes("too large") ||
      message.includes("Too many") ||
      message.includes("IEEE");
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 500 });
  }
}
