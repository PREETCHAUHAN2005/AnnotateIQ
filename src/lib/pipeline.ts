import { db } from "@/lib/db";
import { bus } from "@/lib/events";

// Install process-level handlers so an unhandled rejection in the fire-and-
// forget pipeline never crashes the whole dev server.
if (typeof process !== "undefined") {
  process.on("unhandledRejection", (reason) => {
    console.error("[pipeline] unhandledRejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[pipeline] uncaughtException:", err);
  });
}
import {
  fallbackDifficulty,
  fallbackLanguage,
  fallbackMath,
  fallbackTaxonomy,
  runCritic,
  runDifficulty,
  runLanguage,
  runMath,
  runTaxonomy,
  type UnitInput,
} from "@/lib/agents";
import {
  CONCURRENCY,
  K,
  MAX_ATTEMPTS,
  routeFor,
  score,
} from "@/lib/scoring";
import { CHAPTERS } from "@/lib/schemas";
import type {
  CriticOut,
  DifficultyOut,
  LanguageOut,
  MathOut,
  TaxonomyOut,
  UnitAnnotation,
} from "@/lib/schemas";

type DraftRow = {
  agent: string;
  sampleIdx: number;
  attempt: number;
  payload: unknown;
  latencyMs: number;
};

function majority<T extends string>(vals: T[]): T {
  const counts: Record<string, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as T;
}

/** Fan out all agents for one unit, run critic, score, persist, route. */
export async function processUnit(jobId: string, unitId: string): Promise<void> {
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) return;
  const attempt = (unit.attempt || 0) + 1;

  await db.unit.update({
    where: { id: unitId },
    data: { attempt, status: "labeling" },
  });
  bus.publish(jobId, "unit:start", { unitId, seq: unit.seq, attempt });

  const input: UnitInput = {
    unitId,
    stem: unit.stem || unit.rawText,
    options: unit.optionsJson ? JSON.parse(unit.optionsJson) : null,
  };

  const critique = unit.rawText.includes("<critique>")
    ? unit.rawText.match(/<critique>([\s\S]*?)<\/critique>/)?.[1]
    : undefined;

  const drafts: DraftRow[] = [];

  // ---- Fan-out: taxonomy xK, difficulty xK, math x1, language x1 ----
  // Each agent call is wrapped so a thrown error (rate-limit exhausted, etc.)
  // degrades to a fallback instead of crashing the whole unit.
  const tasks: Promise<void>[] = [];
  const taxonomySamples: (TaxonomyOut | null)[] = [];
  const difficultySamples: (DifficultyOut | null)[] = [];
  let mathOut: MathOut | null = null;
  let languageOut: LanguageOut | null = null;

  const safe = async <T>(
    agent: string,
    sampleIdx: number,
    fn: () => Promise<{ value: T | null; raw: string; latencyMs: number }>,
    fallback: () => T,
    sink: (v: T) => void
  ): Promise<void> => {
    bus.publish(jobId, "agent:start", { unitId, agent, sampleIdx });
    let value: T | null = null;
    let latencyMs = 0;
    let usedFallback = false;
    try {
      const r = await fn();
      value = r.value;
      latencyMs = r.latencyMs;
    } catch (e) {
      usedFallback = true;
      bus.publish(jobId, "agent:error", {
        unitId, agent, sampleIdx,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    const final = value ?? (usedFallback = true, fallback());
    sink(final);
    drafts.push({
      agent,
      sampleIdx,
      attempt,
      payload: value ?? { __fallback: true, ...(fallback() as object) },
      latencyMs,
    });
    bus.publish(jobId, "agent:done", {
      unitId, agent, sampleIdx, latencyMs, ok: !!value && !usedFallback,
    });
  };

  const SKIP_LLM = process.env.SKIP_LLM === "1";

  for (let i = 0; i < K; i++) {
    const idx = i;
    tasks.push(
      safe("taxonomy", idx, SKIP_LLM ? async () => ({ value: null, raw: "", latencyMs: 0 }) : () => runTaxonomy(input), () => fallbackTaxonomy(input.stem, idx), (v) => { taxonomySamples[idx] = v; })
    );
    tasks.push(
      safe("difficulty", idx, SKIP_LLM ? async () => ({ value: null, raw: "", latencyMs: 0 }) : () => runDifficulty(input), () => fallbackDifficulty(input.stem, idx), (v) => { difficultySamples[idx] = v; })
    );
  }
  tasks.push(
    safe("math", 0, SKIP_LLM ? async () => ({ value: null, raw: "", latencyMs: 0 }) : () => runMath(input), () => fallbackMath(input.stem), (v) => { mathOut = v; })
  );
  tasks.push(
    safe("language", 0, SKIP_LLM ? async () => ({ value: null, raw: "", latencyMs: 0 }) : () => runLanguage(input), () => fallbackLanguage(input.stem), (v) => { languageOut = v; })
  );

  await Promise.all(tasks);

  // ---- Merge: majority vote on sampled fields; disjoint spread otherwise ----
  const validTax = taxonomySamples.filter(Boolean) as TaxonomyOut[];
  const validDiff = difficultySamples.filter(Boolean) as DifficultyOut[];

  const chapterSamples = validTax.map((t) => t.chapter);
  const difficultyVals = validDiff.map((d) => d.difficulty);

  // gather concepts from all taxonomy samples (dedupe, cap 4)
  const conceptSet = new Set<string>();
  for (const t of validTax) for (const c of t.concepts) conceptSet.add(c);
  const concepts = Array.from(conceptSet).slice(0, 4);

  const mergedChapter = majority(chapterSamples);
  const mergedDifficulty = majority(difficultyVals);
  // rationale from the first difficulty sample that matches the modal difficulty
  const mergedDiff =
    validDiff.find((d) => d.difficulty === mergedDifficulty) ?? validDiff[0];

  bus.publish(jobId, "unit:merge", {
    unitId,
    chapterSamples,
    difficultySamples: difficultyVals,
    mergedChapter,
    mergedDifficulty,
  });

  // ---- Critic ---- (wrapped so a rate-limit failure doesn't crash the unit)
  const mergedForCritic = {
    chapter: mergedChapter,
    concepts,
    latex: mathOut?.latex ?? [],
    difficulty_rationale: mergedDiff?.difficulty_rationale ?? "",
  };
  bus.publish(jobId, "agent:start", { unitId, agent: "critic", sampleIdx: 0 });
  let critic: CriticOut = { passed: false, failures: ["critic: call failed"] };
  let criticLatency = 0;
  if (SKIP_LLM) {
    // heuristic critic: chapter must be valid; rationale must quote stem text.
    // The heuristic rationale wraps a verbatim stem fragment in quotes.
    const validChapter = CHAPTERS.includes(mergedChapter);
    const rationale = mergedDiff?.difficulty_rationale ?? "";
    const stemLower = input.stem.toLowerCase();
    // extract quoted phrases from rationale and check if any appears in stem
    const quotes = rationale.match(/"([^"]+)"/g) ?? [];
    const quotesStem = quotes.some((q) => {
      const inner = q.replace(/"/g, "").toLowerCase().replace(/\.\.\.$/, "").trim();
      return inner.length > 8 && stemLower.includes(inner);
    });
    const passed = validChapter && quotesStem;
    const failures: string[] = [];
    if (!validChapter) failures.push("critic: chapter not in taxonomy");
    if (!quotesStem) failures.push("critic: rationale does not quote stem");
    critic = { passed, failures };
    criticLatency = 1;
  } else {
    try {
      const criticRes = await runCritic(input, mergedForCritic);
      criticLatency = criticRes.latencyMs;
      if (criticRes.value) critic = criticRes.value;
      else critic = { passed: false, failures: ["critic: unparseable response"] };
    } catch (e) {
      bus.publish(jobId, "agent:error", {
        unitId, agent: "critic", sampleIdx: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  drafts.push({
    agent: "critic",
    sampleIdx: 0,
    attempt,
    payload: critic,
    latencyMs: criticLatency,
  });
  bus.publish(jobId, "critic:done", {
    unitId,
    passed: critic.passed,
    failures: critic.failures,
    latencyMs: criticLatency,
  });

  // ---- Score ----
  const { confidence, agreement } = score(
    { chapter: chapterSamples, difficulty: difficultyVals },
    critic.passed
  );
  const route = routeFor(confidence);

  // ---- Persist drafts ----
  for (const d of drafts) {
    await db.draft.create({
      data: {
        unitId,
        agent: d.agent,
        sampleIdx: d.sampleIdx,
        attempt: d.attempt,
        payload: JSON.stringify(d.payload),
        latencyMs: d.latencyMs,
      },
    });
  }

  // ---- Quality events ----
  if (!critic.passed) {
    await db.qualityEvent.create({
      data: { unitId, jobId, kind: "critic_fail", detail: JSON.stringify(critic.failures) },
    });
  }
  if (agreement < 1) {
    await db.qualityEvent.create({
      data: {
        unitId,
        jobId,
        kind: "disagreement",
        detail: JSON.stringify({ chapter: chapterSamples, difficulty: difficultyVals }),
      },
    });
  }

  // ---- Honeypot check ----
  if (unit.isHoneypot && unit.goldPayload) {
    const gold = JSON.parse(unit.goldPayload) as { chapter: string; difficulty: string };
    const pass = gold.chapter === mergedChapter && gold.difficulty === mergedDifficulty;
    await db.qualityEvent.create({
      data: {
        unitId,
        jobId,
        kind: pass ? "honeypot_pass" : "honeypot_fail",
        detail: JSON.stringify({
          gold: { chapter: gold.chapter, difficulty: gold.difficulty },
          predicted: { chapter: mergedChapter, difficulty: mergedDifficulty },
        }),
      },
    });
    bus.publish(jobId, "honeypot", { unitId, pass });
  }

  // ---- Retry or finalize ----
  if (!critic.passed && attempt < MAX_ATTEMPTS) {
    bus.publish(jobId, "unit:retry", { unitId, attempt, critique: critic.failures });
    // inject critique into the stem for the next attempt
    const cleanStem = input.stem.replace(/<critique>[\s\S]*?<\/critique>\s*/, "").trim();
    const retryStem = `${cleanStem}\n\n<critique>${critic.failures.join("; ")}</critique>`;
    await db.unit.update({
      where: { id: unitId },
      data: { stem: retryStem, status: "pending" },
    });
    await db.qualityEvent.create({
      data: { unitId, jobId, kind: "retry", detail: JSON.stringify({ attempt, critique: critic.failures }) },
    });
    // recurse for the retry attempt
    await processUnit(jobId, unitId);
    return;
  }

  // ---- Write final ----
  const annotation: UnitAnnotation = {
    unit_id: unitId,
    stem: input.stem.replace(/<critique>[\s\S]*?<\/critique>\s*/, "").trim(),
    options: input.options,
    subject: "physics",
    chapter: mergedChapter,
    concepts,
    difficulty: mergedDifficulty,
    bloom: mergedDiff?.bloom ?? "understand",
    difficulty_rationale: mergedDiff?.difficulty_rationale ?? "",
    latex: mathOut?.latex ?? [],
    has_equation: mathOut?.has_equation ?? false,
    language: languageOut?.language ?? "en",
    code_mix_ratio: languageOut?.code_mix_ratio ?? 0,
    confidence,
    agreement,
    route,
  };

  await db.final.upsert({
    where: { unitId },
    create: {
      unitId,
      jobId,
      payload: JSON.stringify(annotation),
      confidence,
      agreement,
      route,
    },
    update: {
      jobId,
      payload: JSON.stringify(annotation),
      confidence,
      agreement,
      route,
    },
  });
  await db.unit.update({ where: { id: unitId }, data: { status: "labeled" } });

  bus.publish(jobId, "unit:route", { unitId, seq: unit.seq, route, confidence, agreement, criticPassed: critic.passed });
}

/** Run the whole pipeline for a job with a bounded concurrency semaphore. */
export async function runPipeline(jobId: string): Promise<void> {
  try {
    await db.job.update({ where: { id: jobId }, data: { status: "labeling" } });
    bus.publish(jobId, "job:status", { status: "labeling" });

    // reset any units stuck mid-flight from a previous crashed run back to pending
    await db.unit.updateMany({
      where: { jobId, status: "labeling" },
      data: { status: "pending" },
    });

    const units = await db.unit.findMany({
      where: { jobId },
      orderBy: { seq: "asc" },
      include: { final: true },
    });
    // only process units without a final yet (idempotent re-runs)
    const todo = units.filter((u) => !u.final);
    bus.publish(jobId, "job:status", { status: "labeling", total: todo.length, done: units.length - todo.length });

    let done = units.length - todo.length;
    const queue = [...todo];

    async function worker() {
      while (queue.length) {
        const unit = queue.shift();
        if (!unit) break;
        try {
          await processUnit(jobId, unit.id);
        } catch (err) {
          bus.publish(jobId, "unit:error", {
            unitId: unit.id,
            seq: unit.seq,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        done++;
        bus.publish(jobId, "job:progress", { done, total: units.length });
      }
    }

    // simple semaphore: spawn CONCURRENCY workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENCY, todo.length); i++) workers.push(worker());
    await Promise.all(workers);

    // tally
    const finals = await db.final.findMany({ where: { jobId } });
    const auto = finals.filter((f) => f.route === "auto").length;
    const human = finals.filter((f) => f.route === "human").length;
    await db.job.update({
      where: { id: jobId },
      data: { status: "review", autoCount: auto, humanCount: human, unitCount: units.length },
    });
    bus.publish(jobId, "job:status", { status: "review", auto, human, total: units.length });
  } catch (err) {
    await db.job.update({ where: { id: jobId }, data: { status: "failed" } });
    bus.publish(jobId, "job:status", {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
