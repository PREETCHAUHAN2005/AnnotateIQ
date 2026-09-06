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
  if (raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw)) return raw;
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

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

async function ensureSchema() {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      try {
        await base.$queryRaw`SELECT 1 FROM "Job" LIMIT 1`;
      } catch (cause) {
        console.warn(
          "[db] SQLite schema missing; bootstrapping",
          cause instanceof Error ? cause.message : cause
        );
        await base.$executeRawUnsafe("PRAGMA foreign_keys = ON");
        for (const stmt of SQLITE_BOOTSTRAP_STATEMENTS) {
          await base.$executeRawUnsafe(stmt);
        }
        await base.$queryRaw`SELECT 1 FROM "Job" LIMIT 1`;
      }
    })().catch((err) => {
      globalForPrisma.schemaReady = undefined;
      throw err;
    });
  }
  return globalForPrisma.schemaReady;
}

export const db = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      await ensureSchema();
      return query(args);
    },
  },
}) as unknown as PrismaClient;
