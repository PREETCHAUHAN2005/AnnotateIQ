import { NextResponse } from "next/server";
import { getIeeeDatasetInfo } from "@/lib/ieee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getIeeeDatasetInfo());
}
