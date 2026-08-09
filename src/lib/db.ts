import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * On Vercel the filesystem is read-only except /tmp.
 * Seed /tmp from the committed demo DB on first cold start.
 */
function ensureWritableSqlite() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return;

  const filePath = url.replace(/^file:/, "");
  // Only auto-seed absolute /tmp paths (Vercel demo mode)
  if (!filePath.startsWith("/tmp/")) return;
  if (existsSync(/*turbopackIgnore: true*/ filePath)) return;

  const dir = path.dirname(filePath);
  if (!existsSync(/*turbopackIgnore: true*/ dir)) {
    mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  }

  // Statically scoped to ./db so tracing does not pull the whole repo
  const seed = path.join(process.cwd(), "db", "custom.db");
  if (existsSync(/*turbopackIgnore: true*/ seed)) {
    copyFileSync(/*turbopackIgnore: true*/ seed, /*turbopackIgnore: true*/ filePath);
  }
}

ensureWritableSqlite();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
