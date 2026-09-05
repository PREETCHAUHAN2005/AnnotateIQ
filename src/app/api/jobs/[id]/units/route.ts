import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const units = await db.unit.findMany({
    where: { jobId: id },
    orderBy: { seq: "asc" },
    select: {
      id: true,
      jobId: true,
      seq: true,
      page: true,
      stem: true,
      optionsJson: true,
      isHoneypot: true,
      attempt: true,
      status: true,
      createdAt: true,
      final: {
        select: {
          route: true,
          confidence: true,
          agreement: true,
          reviewerAction: true,
        },
      },
    },
  });
  return NextResponse.json({ units });
}
