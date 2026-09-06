import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";

export function dbRouteError(context: string, e: unknown, extra: Record<string, unknown> = {}) {
  console.error(context, e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Database unavailable", ...extra },
    { status: 500 }
  );
}

export async function withDbJson<T>(
  context: string,
  fn: () => Promise<T>,
  fallback?: Record<string, unknown>
): Promise<NextResponse> {
  try {
    await ensureDb();
    const data = await fn();
    return NextResponse.json(data);
  } catch (e) {
    return dbRouteError(context, e, fallback ?? {});
  }
}
