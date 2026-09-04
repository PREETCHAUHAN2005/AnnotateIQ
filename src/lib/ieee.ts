import { existsSync, readFileSync } from "fs";
import path from "path";
import { fromIeeeCis } from "@/lib/normalize";
import type { CanonicalPaymentEvent } from "@/lib/schemas";
import type { IeeeDatasetInfo } from "@/lib/types";

export const IEEE_RELATIVE = "data/ieee-cis-sample.json";

export function ieeeAbsolutePath(): string {
  return path.join(process.cwd(), IEEE_RELATIVE);
}

export function getIeeeDatasetInfo(): IeeeDatasetInfo {
  const abs = ieeeAbsolutePath();
  if (!existsSync(abs)) {
    return {
      available: false,
      path: IEEE_RELATIVE,
      count: 0,
      message: `Place an IEEE-CIS-shaped JSON array at ${IEEE_RELATIVE} (no Kaggle download from this app).`,
    };
  }
  try {
    const rows = loadIeeeRows();
    return {
      available: true,
      path: IEEE_RELATIVE,
      count: rows.length,
      message: `Found ${rows.length} IEEE-CIS-shaped rows.`,
    };
  } catch (e) {
    return {
      available: false,
      path: IEEE_RELATIVE,
      count: 0,
      message: e instanceof Error ? e.message : "Failed to parse IEEE fixture.",
    };
  }
}

export function loadIeeeRows(): unknown[] {
  const abs = ieeeAbsolutePath();
  const raw = readFileSync(abs, "utf8").trim();
  if (abs.endsWith(".csv") || raw.includes("TransactionID,")) {
    return parseCsv(raw);
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.rows ?? [];
}

export function loadIeeeCanonicalEvents(): CanonicalPaymentEvent[] {
  return loadIeeeRows().map((row) => fromIeeeCis(row));
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i]?.trim() ?? "";
    });
    return row;
  });
}
