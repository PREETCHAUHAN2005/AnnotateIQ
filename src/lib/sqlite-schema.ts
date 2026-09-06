/** Prisma `migrate diff` SQLite DDL — applied on Vercel when /tmp has no tables yet. */
export const SQLITE_BOOTSTRAP_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'sample',
    "kind" TEXT NOT NULL DEFAULT 'risk',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "autoCount" INTEGER NOT NULL DEFAULT 0,
    "humanCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "bbox" TEXT,
    "rawText" TEXT NOT NULL,
    "stem" TEXT,
    "optionsJson" TEXT,
    "isHoneypot" BOOLEAN NOT NULL DEFAULT false,
    "goldPayload" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "sampleIdx" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "payload" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Final" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "agreement" REAL NOT NULL,
    "route" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewerAction" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Final_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Final_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "QualityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualityEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QualityEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Honeypot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "stem" TEXT NOT NULL,
    "optionsJson" TEXT,
    "goldPayload" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Draft_unitId_agent_idx" ON "Draft"("unitId", "agent")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Final_unitId_key" ON "Final"("unitId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Honeypot_seq_key" ON "Honeypot"("seq")`,
];
