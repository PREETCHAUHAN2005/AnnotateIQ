import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { SQLITE_BOOTSTRAP_STATEMENTS } from "@/lib/sqlite-schema";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaReady: Promise<void> | undefined;
};

/**
 * Vercel production/preview: SQLite must live in /tmp (the only writable path).
 * Local `next dev` keeps DATABASE_URL from `.env` (file:../db/custom.db).
 * Without an LLM key on Vercel we default to deterministic heuristics — the UI
 * must label that mode "Deterministic fallback demo".
 */
function applyRuntimeEnv() {
  if (process.env.VERCEL && process.env.SKIP_LLM !== "0") {
    process.env.SKIP_LLM ??= "1";
  }

  const url = process.env.DATABASE_URL;
  const isSqliteFile = !url || url.startsWith("file:");
  const onLinuxVercel = Boolean(process.env.VERCEL) && process.platform !== "win32";
  if (onLinuxVercel && isSqliteFile) {
    process.env.DATABASE_URL = "file:/tmp/annotate.db";
  } else if (!url) {
    process.env.DATABASE_URL = "file:../db/custom.db";
  }
}

function sqliteFilePath(url: string): string {
  const raw = url.replace(/^file:/, "");
  const winDrive =
    raw.length >= 3 &&
    raw[1] === ":" &&
    (raw[2] === "\\" || raw[2] === "/") &&
    ((raw[0] >= "A" && raw[0] <= "Z") || (raw[0] >= "a" && raw[0] <= "z"));
  if (raw.startsWith("/") || winDrive) return raw;
  // Prisma resolves relative file: URLs from the schema directory
  return path.resolve(process.cwd(), "prisma", raw);
}

function prepareSqliteFile() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return;

  const filePath = sqliteFilePath(url);
  const dir = path.dirname(filePath);
  if (!existsSync(/*turbopackIgnore: true*/ dir)) {
    mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  }
  if (existsSync(/*turbopackIgnore: true*/ filePath)) return;

  const seeds = [
    path.join(process.cwd(), "db", "demo.sqlite"),
    path.join(process.cwd(), "db", "custom.db"),
  ];
  for (const seed of seeds) {
    if (existsSync(/*turbopackIgnore: true*/ seed)) {
      copyFileSync(/*turbopackIgnore: true*/ seed, /*turbopackIgnore: true*/ filePath);
      return;
    }
  }
}

applyRuntimeEnv();
prepareSqliteFile();

const databaseUrl = process.env.DATABASE_URL ?? "file:../db/custom.db";

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasources: { db: { url: databaseUrl } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

async function ensureSchema() {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      await base.$connect();
      await base.$executeRawUnsafe("PRAGMA foreign_keys = ON");
      for (const stmt of SQLITE_BOOTSTRAP_STATEMENTS) {
        await base.$executeRawUnsafe(stmt);
      }
    })().catch((err) => {
      globalForPrisma.schemaReady = undefined;
      console.error(
        "[db] schema bootstrap failed",
        err instanceof Error ? err.message : err
      );
      throw err;
    });
  }
  return globalForPrisma.schemaReady;
}

/** Await before the first query in a serverless isolate. Idempotent. */
export async function ensureDb(): Promise<PrismaClient> {
  await ensureSchema();
  return base;
}

export const db = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      await ensureSchema();
      return query(args);
    },
  },
}) as unknown as PrismaClient;
