import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, RATE_JOBS_MUTATE } from "@/lib/http-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job });
}

// DELETE /api/jobs/[id] — delete a job and all its units/drafts/finals/events (cascade)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, "jobs:mutate", RATE_JOBS_MUTATE);
  if (limited) return limited;

  const { id } = await ctx.params;
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.job.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
