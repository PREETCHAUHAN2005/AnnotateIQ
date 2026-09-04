import { db } from "@/lib/db";
import { buildHoneypotPool, SAMPLE_BATCHES } from "@/lib/data/sample-transactions";
import { toCanonicalEvent } from "@/lib/normalize";
import type { CanonicalPaymentEvent, GoldRisk } from "@/lib/schemas";

export type Segment = { seq: number; page: number; stem: string };

export function parseEventList(input: unknown): CanonicalPaymentEvent[] {
  let raw = input;
  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return [];
    raw = JSON.parse(text);
  }
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  return arr.map((row, i) => {
    const event = toCanonicalEvent(row);
    if (!event.transaction_id) event.transaction_id = `TX_PASTE_${i + 1}`;
    return event;
  });
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
  const pack = SAMPLE_BATCHES.find((p) => p.id === packId) ?? SAMPLE_BATCHES[0];
  return createJobWithUnits(
    pack.filename,
    "sample",
    pack.units.map((u) => {
      const { gold, ...event } = u.event;
      return { seq: u.seq, event, gold };
    })
  );
}

export async function createJobFromText(filename: string, text: string): Promise<string> {
  const events = parseEventList(text);
  if (events.length === 0) {
    throw new Error("No payment events found. Paste a JSON array of transactions.");
  }
  return createJobWithUnits(
    filename,
    "paste",
    events.map((event, i) => ({ seq: i + 1, event }))
  );
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

type UnitSpec = {
  seq: number;
  event: CanonicalPaymentEvent;
  gold?: GoldRisk;
};

async function createJobWithUnits(filename: string, source: string, specs: UnitSpec[]): Promise<string> {
  const job = await db.job.create({
    data: { filename, source, status: "extracting", unitCount: specs.length },
  });

  const honeypots = buildHoneypotPool();
  const honeypotCount = Math.max(1, Math.floor(specs.length / 6));
  const honeypotSlots = new Set<number>();
  while (honeypotSlots.size < honeypotCount && honeypotSlots.size < specs.length) {
    honeypotSlots.add(Math.floor(Math.random() * specs.length));
  }

  const rows = specs.map((s, i) => {
    const slot = honeypotSlots.has(i);
    if (slot && honeypots.length) {
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
