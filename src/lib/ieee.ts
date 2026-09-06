import { existsSync, readFileSync } from "fs";
import path from "path";
import { IEEE_COLUMN_MAP } from "@/lib/data/ieee-columns";
import { toCanonicalEvent } from "@/lib/normalize";
import type { CanonicalPaymentEvent, GoldRisk } from "@/lib/schemas";
import type { IeeeDatasetInfo } from "@/lib/types";

export { IEEE_COLUMN_MAP };

export const IEEE_RELATIVE = "data/ieee-cis-sample.json";
export const IEEE_IDENTITY_RELATIVE = "data/ieee-cis-identity.json";

/** Hard cap so a 590k Kaggle dump cannot be ingested in-process. */
export const MAX_INGEST_EVENTS = 400;
export const MAX_INGEST_BYTES = 1_500_000;

export type IeeeIngestSpec = {
  seq: number;
  event: CanonicalPaymentEvent;
  gold?: GoldRisk;
};

export function ieeeAbsolutePath(rel = IEEE_RELATIVE): string {
  return path.join(process.cwd(), "data", path.basename(rel));
}

function readLocalRows(rel: string): unknown[] {
  const abs = ieeeAbsolutePath(rel);
  if (!existsSync(abs)) return [];
  return parseIeeePayload(readFileSync(abs, "utf8")).rows;
}

export function getIeeeDatasetInfo(): IeeeDatasetInfo {
  const abs = ieeeAbsolutePath();
  if (!existsSync(abs)) {
    return {
      available: false,
      path: IEEE_RELATIVE,
      count: 0,
      identityAvailable: existsSync(ieeeAbsolutePath(IEEE_IDENTITY_RELATIVE)),
      identityPath: IEEE_IDENTITY_RELATIVE,
      identityCount: 0,
      fraudGoldCount: 0,
      message: `Place an IEEE-CIS-shaped JSON or CSV at ${IEEE_RELATIVE} (no Kaggle download from this app). Optional identity join: ${IEEE_IDENTITY_RELATIVE}.`,
    };
  }
  try {
    const specs = loadIeeeIngestSpecs();
    const identity = readLocalRows(IEEE_IDENTITY_RELATIVE);
    const fraudGoldCount = specs.filter((s) => s.gold).length;
    return {
      available: true,
      path: IEEE_RELATIVE,
      count: specs.length,
      identityAvailable: identity.length > 0,
      identityPath: IEEE_IDENTITY_RELATIVE,
      identityCount: identity.length,
      fraudGoldCount,
      message: `Found ${specs.length} IEEE-CIS-shaped rows${identity.length ? `, joined ${identity.length} identity rows` : ""}. ${fraudGoldCount} rows have isFraud gold (honeypot only).`,
    };
  } catch (e) {
    return {
      available: false,
      path: IEEE_RELATIVE,
      count: 0,
      identityAvailable: false,
      identityPath: IEEE_IDENTITY_RELATIVE,
      identityCount: 0,
      fraudGoldCount: 0,
      message: e instanceof Error ? e.message : "Failed to parse IEEE fixture.",
    };
  }
}

export function loadIeeeRows(): unknown[] {
  return readLocalRows(IEEE_RELATIVE);
}

export function loadIeeeIdentityRows(): unknown[] {
  return readLocalRows(IEEE_IDENTITY_RELATIVE);
}

export function loadIeeeCanonicalEvents(): CanonicalPaymentEvent[] {
  return loadIeeeIngestSpecs().map((s) => s.event);
}

export function loadIeeeIngestSpecs(): IeeeIngestSpec[] {
  const abs = ieeeAbsolutePath();
  if (!existsSync(abs)) {
    throw new Error(`Place an IEEE-CIS-shaped JSON or CSV at ${IEEE_RELATIVE} (no Kaggle download).`);
  }
  const parsed = parseIeeePayload(readFileSync(abs, "utf8"));
  const identity = parsed.identity.length ? parsed.identity : loadIeeeIdentityRows();
  return rowsToIngestSpecs(parsed.rows, identity);
}

export function rowsToIngestSpecs(transactions: unknown[], identity: unknown[] = []): IeeeIngestSpec[] {
  const joined = identity.length ? joinIeeeIdentity(transactions, identity) : transactions;
  if (joined.length > MAX_INGEST_EVENTS) {
    throw new Error(
      `Too many events (${joined.length}). Cap is ${MAX_INGEST_EVENTS} so a full IEEE-CIS dump cannot run in-process. Split the file locally.`
    );
  }
  return joined.map((row, i) => {
    const gold = extractIeeeFraudGold(row);
    const event = toCanonicalEvent(row);
    if (!event.transaction_id) event.transaction_id = `IEEE_${i + 1}`;
    return { seq: i + 1, event, gold };
  });
}

export function joinIeeeIdentity(transactions: unknown[], identity: unknown[]): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of identity) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.TransactionID ?? r.transaction_id ?? "").trim();
    if (id) byId.set(id, r);
  }
  return transactions.map((row) => {
    if (!row || typeof row !== "object") return {};
    const r = row as Record<string, unknown>;
    const id = String(r.TransactionID ?? r.transaction_id ?? "").trim();
    const ident = id ? byId.get(id) : undefined;
    if (!ident) return { ...r };
    // Identity fills gaps; transaction columns win on conflict.
    return { ...ident, ...r };
  });
}

export function extractIeeeFraudGold(row: unknown): GoldRisk | undefined {
  if (!row || typeof row !== "object") return undefined;
  const raw = (row as Record<string, unknown>).isFraud;
  if (raw === 1 || raw === "1" || raw === true || raw === "true") {
    return { risk_label: "HIGH", recommended_action: "HOLD" };
  }
  if (raw === 0 || raw === "0" || raw === false || raw === "false") {
    return { risk_label: "LOW", recommended_action: "ALLOW" };
  }
  return undefined;
}

export function parseIeeePayload(text: string): { rows: unknown[]; identity: unknown[] } {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], identity: [] };
  if (trimmed.length > MAX_INGEST_BYTES) {
    throw new Error(
      `File too large (${trimmed.length} bytes). Cap is ${MAX_INGEST_BYTES} bytes. This app never downloads Kaggle and will not ingest a 590k-row dump.`
    );
  }
  if (looksLikeCsv(trimmed)) {
    return { rows: parseCsv(trimmed), identity: [] };
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (Array.isArray(parsed)) return { rows: parsed, identity: [] };
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if ("TransactionID" in o || "TransactionAmt" in o || "transaction_id" in o) {
      return { rows: [o], identity: [] };
    }
    const rows = asArray(o.transactions) ?? asArray(o.rows) ?? asArray(o.data) ?? [];
    const identity = asArray(o.identity) ?? asArray(o.identities) ?? [];
    return { rows, identity };
  }
  return { rows: [], identity: [] };
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

export function looksLikeCsv(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("[") || t.startsWith("{")) return false;
  const first = t.split(/\r?\n/, 1)[0] ?? "";
  return first.includes(",") && /TransactionID|transaction_id|TransactionAmt|\bamount\b/i.test(first);
}

export function parseCsv(text: string): Record<string, string>[] {
  const table = parseCsvRows(text);
  if (table.length < 2) return [];
  const headers = table[0].map((h) => h.trim());
  return table
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) row[h] = cells[i]?.trim() ?? "";
      });
      return row;
    });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.length)) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
