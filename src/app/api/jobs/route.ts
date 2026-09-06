import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { createJobFromIeee, createJobFromSample, createJobFromText } from "@/lib/ingest";
import { FAILURE_BATCHES } from "@/lib/data/sample-failures";
import { SAMPLE_BATCHES } from "@/lib/data/sample-transactions";
import { getIeeeDatasetInfo } from "@/lib/ieee";
import { asRecord, enforceRateLimit, RATE_JOBS_CREATE, readJsonBody } from "@/lib/http-guards";
import { dbRouteError } from "@/lib/route-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const jobs = await db.job.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ jobs, ieee: getIeeeDatasetInfo() });
  } catch (e) {
    return dbRouteError("[GET /api/jobs]", e, { jobs: [] });
  }
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "jobs:create", RATE_JOBS_CREATE);
  if (limited) return limited;

  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.body);

  try {
    let jobId: string;

    if (body.mode === "sample") {
      const pack =
        SAMPLE_BATCHES.find((p) => p.id === body.packId) ??
        FAILURE_BATCHES.find((p) => p.id === body.packId) ??
        SAMPLE_BATCHES[0];
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
    if (!clientError) console.error("job create error", e);
    return NextResponse.json(
      { error: clientError ? message : "Job create failed" },
      { status: clientError ? 400 : 500 }
    );
  }
}
