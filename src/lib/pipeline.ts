import { db } from "@/lib/db";
import { bus } from "@/lib/events";

if (typeof process !== "undefined") {
  process.on("unhandledRejection", (reason) => {
    console.error("[pipeline] unhandledRejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[pipeline] uncaughtException:", err);
  });
}

import {
  fallbackAdjudicator,
  fallbackBehavioral,
  fallbackDeviceNetwork,
  fallbackFraudReasoning,
  fallbackMerchantOrder,
  fallbackRingAnalyst,
  fallbackTransactionRisk,
  runAdjudicator,
  runBehavioral,
  runDeviceNetwork,
  runFraudReasoning,
  runMerchantOrder,
  runRingAnalyst,
  runTransactionRisk,
  type SpecialistPacket,
  type UnitInput,
} from "@/lib/agents";
import { computeDerivedSignals, parseUnitEvent } from "@/lib/normalize";
import { buildJobRings, emptyRing, type RingAssignment } from "@/lib/rings";
import { CONCURRENCY, K, MAX_ATTEMPTS, routeFor, score } from "@/lib/scoring";
import type {
  AdjudicatorOut,
  BehavioralOut,
  DeviceNetworkOut,
  FraudReasoningOut,
  MerchantOrderOut,
  RecommendedAction,
  RingAnalystOut,
  TransactionRiskOut,
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

export async function processUnit(jobId: string, unitId: string): Promise<void> {
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) return;
  const attempt = (unit.attempt || 0) + 1;

  await db.unit.update({
    where: { id: unitId },
    data: { attempt, status: "labeling" },
  });
  bus.publish(jobId, "unit:start", { unitId, seq: unit.seq, attempt });

  const event = parseUnitEvent(unit.rawText, unit.stem);
  const siblings = await db.unit.findMany({
    where: { jobId },
    select: { id: true, seq: true, rawText: true },
  });
  const ringEvents = siblings.flatMap((s) => {
    try {
      return [{ unitId: s.id, seq: s.seq, event: parseUnitEvent(s.rawText) }];
    } catch {
      return [];
    }
  });
  const ringMap = buildJobRings(ringEvents);
  const ringBase: RingAssignment = ringMap.get(unitId) ?? emptyRing(event.transaction_id);
  const sameDeviceInJob = event.device_id_hash
    ? siblings.filter((s) => {
        try {
          return parseUnitEvent(s.rawText).device_id_hash === event.device_id_hash;
        } catch {
          return false;
        }
      }).length
    : 1;
  const derived = computeDerivedSignals(event, { sameDeviceInJob });
  const input: UnitInput = { unitId, event, derived };

  const drafts: DraftRow[] = [];
  const SKIP_LLM = process.env.SKIP_LLM === "1";

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
        unitId,
        agent,
        sampleIdx,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    const final = value ?? ((usedFallback = true), fallback());
    sink(final);
    drafts.push({
      agent,
      sampleIdx,
      attempt,
      payload: value == null ? { __fallback: true, ...(final as object) } : final,
      latencyMs,
    });
    bus.publish(jobId, "agent:done", {
      unitId,
      agent,
      sampleIdx,
      latencyMs,
      ok: !!value && !usedFallback,
    });
  };

  let txnOut: TransactionRiskOut | null = null;
  let behOut: BehavioralOut | null = null;
  let devOut: DeviceNetworkOut | null = null;
  let merOut: MerchantOrderOut | null = null;

  await Promise.all([
    safe(
      "transaction_risk",
      0,
      SKIP_LLM
        ? async () => ({ value: null, raw: "", latencyMs: 0 })
        : () => runTransactionRisk(input),
      () => fallbackTransactionRisk(event, derived),
      (v) => {
        txnOut = v;
      }
    ),
    safe(
      "behavioral",
      0,
      SKIP_LLM ? async () => ({ value: null, raw: "", latencyMs: 0 }) : () => runBehavioral(input),
      () => fallbackBehavioral(event, derived),
      (v) => {
        behOut = v;
      }
    ),
    safe(
      "device_network",
      0,
      SKIP_LLM
        ? async () => ({ value: null, raw: "", latencyMs: 0 })
        : () => runDeviceNetwork(input),
      () => fallbackDeviceNetwork(event, derived),
      (v) => {
        devOut = v;
      }
    ),
    safe(
      "merchant_order",
      0,
      SKIP_LLM
        ? async () => ({ value: null, raw: "", latencyMs: 0 })
        : () => runMerchantOrder(input),
      () => fallbackMerchantOrder(event, derived),
      (v) => {
        merOut = v;
      }
    ),
  ]);

  const specialists: SpecialistPacket = {
    transaction_risk: txnOut?.transaction_risk ?? "MEDIUM",
    behavior_anomaly: behOut?.behavior_anomaly ?? false,
    behavioral_pattern: behOut?.behavioral_pattern ?? "NONE",
    device_risk: devOut?.device_risk ?? "LOW",
    merchant_context_risk: merOut?.merchant_context_risk ?? "LOW",
  };

  const reasonSamples: (FraudReasoningOut | null)[] = [];
  const reasonTasks: Promise<void>[] = [];
  for (let i = 0; i < K; i++) {
    const idx = i;
    reasonTasks.push(
      safe(
        "fraud_reasoning",
        idx,
        SKIP_LLM
          ? async () => ({ value: null, raw: "", latencyMs: 0 })
          : () => runFraudReasoning(input, specialists),
        () => fallbackFraudReasoning(event, derived, specialists, idx),
        (v) => {
          reasonSamples[idx] = v;
        }
      )
    );
  }
  await Promise.all(reasonTasks);

  const validReason = reasonSamples.filter(Boolean) as FraudReasoningOut[];
  const labelSamples = validReason.map((r) => r.risk_label);
  const actionSamples = validReason.map((r) => r.recommended_action);
  const mergedLabel = majority(labelSamples);
  const mergedAction = majority(actionSamples) as RecommendedAction;
  const mergedReason =
    validReason.find((r) => r.risk_label === mergedLabel && r.recommended_action === mergedAction) ??
    validReason.find((r) => r.risk_label === mergedLabel) ??
    validReason[0];

  bus.publish(jobId, "unit:merge", {
    unitId,
    riskSamples: labelSamples,
    actionSamples,
    mergedLabel,
    mergedAction,
  });

  bus.publish(jobId, "agent:start", { unitId, agent: "adjudicator", sampleIdx: 0 });
  let adj: AdjudicatorOut = {
    passed: false,
    failures: ["adjudicator: call failed"],
    consensus: "DISPUTED",
    final_label: mergedLabel,
    recommended_action: mergedAction,
    disagreement_reason: "adjudicator unavailable",
  };
  let adjLatency = 0;
  const mergedForAdj = {
    risk_label: mergedLabel,
    recommended_action: mergedAction,
    explanation: mergedReason?.explanation ?? "",
    risk_factors: mergedReason?.risk_factors ?? [],
  };

  if (SKIP_LLM) {
    adj = fallbackAdjudicator(specialists, mergedForAdj);
    adjLatency = 1;
  } else {
    try {
      const res = await runAdjudicator(input, specialists, mergedForAdj);
      adjLatency = res.latencyMs;
      if (res.value) adj = res.value;
      else adj = fallbackAdjudicator(specialists, mergedForAdj);
    } catch (e) {
      bus.publish(jobId, "agent:error", {
        unitId,
        agent: "adjudicator",
        sampleIdx: 0,
        error: e instanceof Error ? e.message : String(e),
      });
      adj = fallbackAdjudicator(specialists, mergedForAdj);
    }
  }

  drafts.push({
    agent: "adjudicator",
    sampleIdx: 0,
    attempt,
    payload: adj,
    latencyMs: adjLatency,
  });

  let ringOut: RingAnalystOut = fallbackRingAnalyst(ringBase);
  let ringLatency = 1;
  bus.publish(jobId, "agent:start", { unitId, agent: "ring_analyst", sampleIdx: 0 });
  if (SKIP_LLM) {
    ringOut = fallbackRingAnalyst(ringBase);
  } else {
    try {
      const res = await runRingAnalyst(input, ringBase);
      ringLatency = res.latencyMs;
      if (res.value) {
        ringOut = res.value;
      }
    } catch (e) {
      bus.publish(jobId, "agent:error", {
        unitId,
        agent: "ring_analyst",
        sampleIdx: 0,
        error: e instanceof Error ? e.message : String(e),
      });
      ringOut = fallbackRingAnalyst(ringBase);
    }
  }
  drafts.push({
    agent: "ring_analyst",
    sampleIdx: 0,
    attempt,
    payload: { ...ringOut, risk_cluster_id: ringBase.risk_cluster_id, cluster_size: ringBase.cluster_size },
    latencyMs: ringLatency,
  });
  bus.publish(jobId, "agent:done", {
    unitId,
    agent: "ring_analyst",
    sampleIdx: 0,
    latencyMs: ringLatency,
    ok: true,
    cluster: ringBase.risk_cluster_id,
  });

  bus.publish(jobId, "critic:done", {
    unitId,
    passed: adj.passed,
    failures: adj.failures,
    consensus: adj.consensus,
    latencyMs: adjLatency,
  });

  const disputed = adj.consensus === "DISPUTED";
  const { confidence, agreement } = score(
    { risk_label: labelSamples, recommended_action: actionSamples },
    adj.passed,
    disputed
  );
  const route = routeFor(confidence, disputed);

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

  if (!adj.passed) {
    await db.qualityEvent.create({
      data: { unitId, jobId, kind: "critic_fail", detail: JSON.stringify(adj.failures) },
    });
  }
  if (disputed) {
    await db.qualityEvent.create({
      data: {
        unitId,
        jobId,
        kind: "disagreement",
        detail: JSON.stringify({ specialists, labels: labelSamples, actions: actionSamples }),
      },
    });
  }
  if (agreement < 1) {
    await db.qualityEvent.create({
      data: {
        unitId,
        jobId,
        kind: "disagreement",
        detail: JSON.stringify({ labels: labelSamples, actions: actionSamples }),
      },
    });
  }

  if (unit.isHoneypot && unit.goldPayload) {
    const gold = JSON.parse(unit.goldPayload) as {
      risk_label?: string;
      recommended_action?: string;
      risk_cluster_id?: string | null;
    };
    const labelPass =
      gold.risk_label === adj.final_label && gold.recommended_action === adj.recommended_action;
    const clusterPass =
      !gold.risk_cluster_id ||
      !ringBase.risk_cluster_id ||
      gold.risk_cluster_id === ringBase.risk_cluster_id;
    const pass = labelPass && clusterPass;
    await db.qualityEvent.create({
      data: {
        unitId,
        jobId,
        kind: pass ? "honeypot_pass" : "honeypot_fail",
        detail: JSON.stringify({
          gold,
          predicted: {
            risk_label: adj.final_label,
            recommended_action: adj.recommended_action,
            risk_cluster_id: ringBase.risk_cluster_id,
          },
        }),
      },
    });
    bus.publish(jobId, "honeypot", { unitId, pass });
  }

  if (!adj.passed && attempt < MAX_ATTEMPTS) {
    bus.publish(jobId, "unit:retry", { unitId, attempt, critique: adj.failures });
    const clean = unit.rawText.replace(/<critique>[\s\S]*?<\/critique>\s*/, "").trim();
    const retryStem = `${clean}\n\n<critique>${adj.failures.join("; ")}</critique>`;
    await db.unit.update({
      where: { id: unitId },
      data: { stem: retryStem, status: "pending" },
    });
    await db.qualityEvent.create({
      data: { unitId, jobId, kind: "retry", detail: JSON.stringify({ attempt, critique: adj.failures }) },
    });
    await processUnit(jobId, unitId);
    return;
  }

  const evidence = [
    ...(txnOut?.evidence ?? []),
    ...(behOut?.evidence ?? []),
    ...(devOut?.evidence ?? []),
    ...(merOut?.evidence ?? []),
  ];

  const annotation: UnitAnnotation = {
    unit_id: unitId,
    event,
    derived,
    risk_label: adj.final_label,
    fraud_probability: mergedReason?.fraud_probability ?? 0.5,
    risk_factors: mergedReason?.risk_factors ?? ["none_material"],
    behavioral_pattern: specialists.behavioral_pattern,
    transaction_anomaly: mergedReason?.transaction_anomaly ?? false,
    chargeback_risk: mergedReason?.chargeback_risk ?? "LOW",
    recommended_action: adj.recommended_action,
    evidence,
    explanation: mergedReason?.explanation ?? adj.disagreement_reason ?? "Adjudicated from specialist signals.",
    final_label: adj.final_label,
    final_score: confidence,
    confidence,
    agreement,
    consensus: adj.consensus,
    disagreement_reason: adj.disagreement_reason,
    route,
    transaction_risk: specialists.transaction_risk,
    behavior_anomaly: specialists.behavior_anomaly,
    device_risk: specialists.device_risk,
    merchant_context_risk: specialists.merchant_context_risk,
    risk_cluster_id: ringBase.risk_cluster_id,
    network_risk: ringOut.network_risk,
    relationship_confidence: ringOut.relationship_confidence,
    shared_entities: ringBase.shared_entities,
    cluster_size: ringBase.cluster_size,
    member_transaction_ids: ringBase.member_transaction_ids,
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
  bus.publish(jobId, "unit:route", {
    unitId,
    seq: unit.seq,
    route,
    confidence,
    agreement,
    criticPassed: adj.passed,
    consensus: adj.consensus,
    risk_label: adj.final_label,
    risk_cluster_id: ringBase.risk_cluster_id,
    cluster_size: ringBase.cluster_size,
  });
}

export async function runPipeline(jobId: string): Promise<void> {
  try {
    await db.job.update({ where: { id: jobId }, data: { status: "labeling" } });
    bus.publish(jobId, "job:status", { status: "labeling" });

    await db.unit.updateMany({
      where: { jobId, status: "labeling" },
      data: { status: "pending" },
    });

    const units = await db.unit.findMany({
      where: { jobId },
      orderBy: { seq: "asc" },
      include: { final: true },
    });
    const todo = units.filter((u) => !u.final);
    bus.publish(jobId, "job:status", {
      status: "labeling",
      total: todo.length,
      done: units.length - todo.length,
    });

    let done = units.length - todo.length;
    const queue = [...todo];

    async function worker() {
      while (queue.length) {
        const u = queue.shift();
        if (!u) break;
        try {
          await processUnit(jobId, u.id);
        } catch (err) {
          await db.unit
            .update({
              where: { id: u.id },
              data: { status: "failed" },
            })
            .catch(() => {});
          bus.publish(jobId, "unit:error", {
            unitId: u.id,
            seq: u.seq,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        done++;
        bus.publish(jobId, "job:progress", { done, total: units.length });
      }
    }

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENCY, todo.length); i++) workers.push(worker());
    await Promise.all(workers);

    const finals = await db.final.findMany({ where: { jobId } });
    const auto = finals.filter((f) => f.route === "auto").length;
    const human = finals.filter((f) => f.route === "human").length;
    const status = human === 0 ? "done" : "review";
    await db.job.update({
      where: { id: jobId },
      data: { status, autoCount: auto, humanCount: human, unitCount: units.length },
    });
    bus.publish(jobId, "job:status", { status, auto, human, total: units.length });
  } catch (err) {
    await db.job.update({ where: { id: jobId }, data: { status: "failed" } });
    bus.publish(jobId, "job:status", {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
