import { NextResponse } from "next/server";

export function dbRouteError(context: string, e: unknown, extra: Record<string, unknown> = {}) {
  console.error(context, e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Database unavailable", ...extra },
    { status: 500 }
  );
}
