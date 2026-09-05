import { db } from "@/lib/db";
import { FAILURE_BATCHES } from "@/lib/data/sample-failures";
import { buildHoneypotPool, SAMPLE_BATCHES } from "@/lib/data/sample-transactions";
import {
  loadIeeeIngestSpecs,
  parseIeeePayload,
  rowsToIngestSpecs,
  type IeeeIngestSpec,
} from "@/lib/ieee";
import type { CanonicalPaymentEvent, GoldRisk } from "@/lib/schemas";

export type Segment = { seq: number; page: number; stem: string };

export function parseEventList(input: unknown): CanonicalPaymentEvent[] {
  return parseIngestSpecs(input).map((s) => s.event);
}

export function parseIngestSpecs(input: unknown): IeeeIngestSpec[] {
  if (typeof input === "string") {
    const parsed = parseIeeePayload(input);
    return rowsToIngestSpecs(parsed.rows, parsed.identity);
  }
  if (Array.isArray(input)) return rowsToIngestSpecs(input);
  if (input && typeof input === "object") {
    const parsed = parseIeeePayload(JSON.stringify(input));
    return rowsToIngestSpecs(parsed.rows, parsed.identity);
  }
  return [];
}

export function segmentText(text: string): Segment[] {
  try {
    return parseEventList(text).map((event, i) => ({
      seq: i + 1,
      page: 1,
      stem: JSON.stringify(event),
    }));
  } catch {
    return [];
  }
}

export async function createJobFromSample(packId: string): Promise<string> {
  const pack =
    SAMPLE_BATCHES.find((p) => p.id === packId) ??
    FAILURE_BATCHES.find((p) => p.id === packId) ??
    SAMPLE_BATCHES[0];
  const kind = pack.kind === "failure" ? "failure" : "risk";
  return createJobWithUnits(
    pack.filename,
    "sample",
    pack.units.map((u) => {
      const { gold, ...event } = u.event;
      return { seq: u.seq, event, gold };
    }),
    { kind }
  );
}

export async function createJobFromText(filename: string, text: string): Promise<string> {
  const specs = parseIngestSpecs(text);
  if (specs.length === 0) {
    throw new Error("No payment events found. Paste a JSON array, IEEE-shaped object, or CSV.");
  }
  return createJobWithUnits(filename, "paste", specs);
}

export async function createJobFromEvents(
  filename: string,
  events: CanonicalPaymentEvent[],
  source = "paste"
): Promise<string> {
  if (events.length === 0) throw new Error("No payment events found.");
  return createJobWithUnits(
    filename,
    source,
    events.map((event, i) => ({ seq: i + 1, event }))
  );
}

export async function createJobFromIeee(): Promise<string> {
  const specs = loadIeeeIngestSpecs();
  if (specs.length === 0) throw new Error("No IEEE-CIS events found.");
  return createJobWithUnits("IEEE-CIS sample", "ieee", specs);
}

type UnitSpec = {
  seq: number;
  event: CanonicalPaymentEvent;
  gold?: GoldRisk;
};

async function createJobWithUnits(
  filename: string,
  source: string,
  specs: UnitSpec[],
  opts?: { kind?: "risk" | "failure" }
): Promise<string> {
  const kind = opts?.kind ?? "risk";
  const job = await db.job.create({
    data: { filename, source, kind, status: "extracting", unitCount: specs.length },
  });

  const honeypots = buildHoneypotPool();
  const honeypotCount = Math.max(1, Math.floor(specs.length / 6));
  const honeypotSlots = new Set<number>();
  const nativeGoldIdx = specs.map((s, i) => (s.gold ? i : -1)).filter((i) => i >= 0);
  const preferNative =
    kind === "failure" || source === "ieee" || (source === "paste" && nativeGoldIdx.length > 0);
  const pool = preferNative && nativeGoldIdx.length ? nativeGoldIdx : specs.map((_, i) => i);
  while (honeypotSlots.size < honeypotCount && honeypotSlots.size < pool.length) {
    honeypotSlots.add(pool[Math.floor(Math.random() * pool.length)]);
  }

  const rows = specs.map((s, i) => {
    const slot = honeypotSlots.has(i);
    if (slot && s.gold) {
      const raw = JSON.stringify(s.event);
      return {
        jobId: job.id,
        seq: s.seq,
        page: 1,
        rawText: raw,
        stem: raw,
        optionsJson: null,
        isHoneypot: true,
        goldPayload: JSON.stringify(s.gold),
        status: "pending",
      };
    }
    if (slot && honeypots.length && !preferNative) {
      const h = honeypots[Math.floor(Math.random() * honeypots.length)];
      const raw = JSON.stringify(h.event);
      return {
        jobId: job.id,
        seq: s.seq,
        page: 1,
        rawText: raw,
        stem: raw,
        optionsJson: null,
        isHoneypot: true,
        goldPayload: JSON.stringify(h.goldPayload),
        status: "pending",
      };
    }
    const raw = JSON.stringify(s.event);
    return {
      jobId: job.id,
      seq: s.seq,
      page: 1,
      rawText: raw,
      stem: raw,
      optionsJson: null,
      isHoneypot: false,
      status: "pending",
    };
  });

  await db.unit.createMany({ data: rows });
  await db.job.update({ where: { id: job.id }, data: { status: "pending" } });
  return job.id;
}
