export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDb } = await import("@/lib/db");
  await ensureDb().catch((err) => {
    console.error("[instrumentation] database bootstrap failed", err);
  });
}
