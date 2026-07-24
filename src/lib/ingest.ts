import { db } from "@/lib/db";
import { buildHoneypotPool, SAMPLE_PAPERS } from "@/lib/data/sample-papers";

// Regex segmenter on question numbering: ^\s*(\d{1,3})[.)]\s
const Q_RE = /(?:^|\n)\s*(\d{1,3})\s*[.)]\s+([^\n]+(?:\n(?!\s*\d{1,3}\s*[.)]\s)[^\n]*)*)/g;

export type Segment = { seq: number; page: number; stem: string };

/** Segment raw text into questions on the rigid exam-paper numbering pattern. */
export function segmentText(text: string): Segment[] {
  const out: Segment[] = [];
  let m: RegExpExecArray | null;
  Q_RE.lastIndex = 0;
  while ((m = Q_RE.exec(text)) !== null) {
    const seq = parseInt(m[1], 10);
    const stem = m[2].trim();
    if (stem.length > 4) out.push({ seq, page: 1, stem });
  }
  // de-dup by seq, keep order
  const seen = new Set<number>();
  return out.filter((s) => (seen.has(s.seq) ? false : (seen.add(s.seq), true)));
}

/** Detect multiple-choice options in a stem; return options or null. */
function extractOptions(stem: string): string[] | null {
  // look for trailing (a) ... (d) or A. ... D.
  const optRe = /\([a-d]\)\s*[^()]+|\b[a-d]\.\s*[^\n]+/gi;
  const matches = stem.match(optRe);
  if (matches && matches.length >= 2) {
    return matches.map((s) => s.replace(/^\(?[a-d]\)?\.?\s*/i, "").trim());
  }
  return null;
}

/**
 * Create a job from a sample paper id. Pre-segmented units come from the
 * curated dataset; ~15% of slots are honeypots injected at random positions.
 */
export async function createJobFromSample(paperId: string): Promise<string> {
  const paper = SAMPLE_PAPERS.find((p) => p.id === paperId) ?? SAMPLE_PAPERS[0];
  const jobId = await createJobWithUnits(
    paper.filename,
    "sample",
    paper.units.map((u) => ({
      seq: u.seq,
      page: u.page,
      stem: u.stem,
      options: u.options,
      gold: u.gold,
    }))
  );
  return jobId;
}

/** Create a job from pasted raw text (segmented with the regex). */
export async function createJobFromText(filename: string, text: string): Promise<string> {
  const segments = segmentText(text);
  if (segments.length === 0) throw new Error("No questions found. Use numbered questions like '1. ...'");
  const units = segments.map((s) => ({
    seq: s.seq,
    page: s.page,
    stem: s.stem,
    options: extractOptions(s.stem),
    gold: undefined as undefined | object,
  }));
  return createJobWithUnits(filename, "paste", units);
}

type UnitSpec = {
  seq: number;
  page: number;
  stem: string;
  options: string[] | null;
  gold?: object;
};

async function createJobWithUnits(filename: string, source: string, specs: UnitSpec[]): Promise<string> {
  const job = await db.job.create({
    data: { filename, source, status: "extracting", unitCount: specs.length },
  });

  // inject honeypots: replace ~1 in 6 unit slots with a honeypot (gold-tagged)
  const honeypots = buildHoneypotPool();
  const honeypotCount = Math.max(1, Math.floor(specs.length / 6));
  const honeypotSlots = new Set<number>();
  while (honeypotSlots.size < honeypotCount && honeypotSlots.size < specs.length) {
    honeypotSlots.add(Math.floor(Math.random() * specs.length));
  }

  const rows = specs.map((s, i) => {
    const slot = honeypotSlots.has(i);
    if (slot) {
      const h = honeypots[Math.floor(Math.random() * honeypots.length)];
      return {
        jobId: job.id,
        seq: s.seq,
        page: s.page,
        rawText: h.stem,
        stem: h.stem,
        optionsJson: h.options ? JSON.stringify(h.options) : null,
        isHoneypot: true,
        goldPayload: JSON.stringify(h.goldPayload),
        status: "pending",
      };
    }
    return {
      jobId: job.id,
      seq: s.seq,
      page: s.page,
      rawText: s.stem,
      stem: s.stem,
      optionsJson: s.options ? JSON.stringify(s.options) : null,
      isHoneypot: false,
      status: "pending",
    };
  });

  await db.unit.createMany({ data: rows });
  await db.job.update({ where: { id: job.id }, data: { status: "pending" } });
  return job.id;
}
