"use client";

import { useEffect, useRef, useState } from "react";
import type { Job, JobStatus, PipelineEvent } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Loader2,
  Cpu,
  GitBranch,
  ShieldCheck,
  Gauge,
  Layers,
  ArrowRight,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UnitState = {
  id: string;
  seq: number;
  status: string;
  attempt: number;
  isHoneypot: boolean;
  draftCount: number;
  route: "auto" | "human" | null;
  confidence: number | null;
};

type LogEntry = { ts: number; type: string; text: string; tone: "info" | "ok" | "warn" | "err" };

const AGENT_NODES = [
  { id: "transaction_risk", label: "Txn risk", sub: "×1 · amount", icon: Gauge, tone: "emerald" as const },
  { id: "behavioral", label: "Behavior", sub: "×1 · velocity", icon: Activity, tone: "teal" as const },
  { id: "device_network", label: "Device", sub: "×1 · geo", icon: Cpu, tone: "violet" as const },
  { id: "merchant_order", label: "Merchant", sub: "×1 · context", icon: Layers, tone: "amber" as const },
];

export function PipelineView({
  job,
  onGoToReview,
  onGoToQuality,
  autoStart = false,
  onAutoStartConsumed,
  onJobStatus,
}: {
  job: Job;
  onGoToReview: () => void;
  onGoToQuality: () => void;
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  onJobStatus?: (patch: Partial<Job> & { id: string }) => void;
}) {
  const [units, setUnits] = useState<UnitState[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeAgents, setActiveAgents] = useState<Record<string, number>>({});
  const [totalAgents, setTotalAgents] = useState<Record<string, number>>({});
  const [criticPass, setCriticPass] = useState(0);
  const [criticFail, setCriticFail] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [autoCount, setAutoCount] = useState(0);
  const [humanCount, setHumanCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pulse, setPulse] = useState<Record<string, number>>({});
  const logRef = useRef<HTMLDivElement>(null);

  // connect to SSE
  useEffect(() => {
    if (!job.id) return;
    setRunning(job.status === "labeling" || job.status === "extracting");
    setTotal(job.unitCount);
    setAutoCount(job.autoCount ?? 0);
    setHumanCount(job.humanCount ?? 0);
    setDone(
      job.status === "review" || job.status === "done" || job.status === "failed"
        ? job.unitCount
        : 0
    );

    const es = new EventSource(`/api/jobs/${job.id}/stream`);
    es.onmessage = (e) => {
      try {
        const evt: PipelineEvent = JSON.parse(e.data);
        handleEvent(evt);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* will auto-reconnect */
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const handleEvent = (evt: PipelineEvent) => {
    const d = evt.data;
    const pushLog = (text: string, tone: LogEntry["tone"]) =>
      setLogs((prev) => [...prev.slice(-200), { ts: evt.ts, type: evt.type, text, tone }]);

    switch (evt.type) {
      case "snapshot":
        setUnits(
          (d.units as UnitState[]).map((u) => ({
            id: u.id,
            seq: u.seq,
            status: u.status,
            attempt: u.attempt,
            isHoneypot: u.isHoneypot,
            draftCount: u.draftCount,
            route: u.route,
            confidence: u.confidence,
          }))
        );
        break;
      case "job:status":
        if (d.status) {
          setRunning(d.status === "labeling" || d.status === "extracting");
          if (d.total) setTotal(d.total as number);
          if (typeof d.auto === "number") setAutoCount(d.auto as number);
          if (typeof d.human === "number") setHumanCount(d.human as number);
          if (d.status === "review" || d.status === "done") {
            pushLog(`Job moved to ${d.status} · ${d.auto ?? 0} auto · ${d.human ?? 0} human`, "ok");
          }
          if (d.status === "failed") pushLog(`Job failed: ${d.error ?? "unknown"}`, "err");
          onJobStatus?.({
            id: job.id,
            status: String(d.status) as JobStatus,
            ...(typeof d.auto === "number" ? { autoCount: d.auto } : {}),
            ...(typeof d.human === "number" ? { humanCount: d.human } : {}),
            ...(typeof d.total === "number" ? { unitCount: d.total } : {}),
          });
        }
        break;
      case "job:progress":
        setDone(d.done as number);
        break;
      case "unit:start":
        pushLog(`Unit #${d.seq} · attempt ${d.attempt} started`, "info");
        setUnits((prev) =>
          prev.map((u) => (u.id === d.unitId ? { ...u, status: "labeling" } : u))
        );
        break;
      case "agent:start":
        setActiveAgents((prev) => ({ ...prev, [d.agent as string]: (prev[d.agent as string] ?? 0) + 1 }));
        setPulse((prev) => ({ ...prev, [d.agent as string]: Date.now() }));
        break;
      case "agent:done":
        setActiveAgents((prev) => ({
          ...prev,
          [d.agent as string]: Math.max(0, (prev[d.agent as string] ?? 0) - 1),
        }));
        setTotalAgents((prev) => ({ ...prev, [d.agent as string]: (prev[d.agent as string] ?? 0) + 1 }));
        break;
      case "unit:merge":
        pushLog(
          `Event #${d.seq ?? "?"} merged → ${d.mergedLabel ?? "?"} · ${d.mergedAction ?? "?"}`,
          "info"
        );
        break;
      case "critic:done":
        if (d.passed) {
          setCriticPass((p) => p + 1);
          pushLog(`Adjudicator PASSED event ${d.unitId} (${d.consensus ?? ""})`, "ok");
        } else {
          setCriticFail((p) => p + 1);
          pushLog(`Adjudicator FAILED event ${d.unitId}: ${(d.failures as string[])?.join("; ")}`, "warn");
        }
        break;
      case "unit:retry":
        pushLog(`Unit ${d.unitId} retrying (attempt ${d.attempt}) — critique injected`, "warn");
        break;
      case "unit:route":
        setUnits((prev) =>
          prev.map((u) =>
            u.id === d.unitId
              ? { ...u, status: "labeled", route: d.route as "auto" | "human", confidence: d.confidence as number }
              : u
          )
        );
        if (d.route === "auto") setAutoCount((p) => p + 1);
        else setHumanCount((p) => p + 1);
        pushLog(
          `Unit #${d.seq} → ${d.route === "auto" ? "AUTO-ACCEPT" : "HUMAN REVIEW"} (conf ${(d.confidence as number).toFixed(2)})${
            d.risk_cluster_id ? ` · ${d.risk_cluster_id} ×${d.cluster_size ?? "?"}` : ""
          }`,
          d.route === "auto" ? "ok" : "warn"
        );
        break;
      case "honeypot":
        pushLog(`Honeypot unit ${d.unitId} ${d.pass ? "PASS ✓" : "FAIL ✗"}`, d.pass ? "ok" : "err");
        break;
      case "unit:error":
        pushLog(`Unit ${d.unitId} error: ${d.error}`, "err");
        break;
    }
  };

  // auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const runPipeline = async () => {
    setLogs([]);
    setCriticPass(0);
    setCriticFail(0);
    setDone(0);
    setAutoCount(0);
    setHumanCount(0);
    setTotalAgents({});
    setRunning(true);
    setShowConfirm(false);
    try {
      await api.runPipeline(job.id);
      toast.success("Pipeline finished");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
      setRunning(false);
    }
  };

  // Auto-start when navigating from Jobs "Run pipeline"
  useEffect(() => {
    if (!autoStart) return;
    onAutoStartConsumed?.();
    if (running) return;
    void runPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, job.id]);

  const handleRunClick = () => {
    setShowConfirm(true);
  };

  const rerunPipeline = async () => {
    if (!confirm("Re-run the pipeline? This clears all existing drafts, finals, and quality events for this job.")) return;
    setRerunning(true);
    try {
      await api.resetJob(job.id);
      toast.success("Job reset — starting pipeline...");
      setRerunning(false);
      runPipeline();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
      setRerunning(false);
    }
  };

  const progressPct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Specialists → fraud reasoning → adjudicator → ring analyst. SSE-streamed, per event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">{job.filename}</Badge>
          <Button onClick={handleRunClick} disabled={running || rerunning} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running…" : "Run pipeline"}
          </Button>
          {(job.status === "review" || job.status === "done") && (
            <Button onClick={rerunPipeline} disabled={running || rerunning} variant="outline" className="gap-2">
              {rerunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Re-run
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">
              {done} / {total} units routed
            </span>
            <span className="font-mono text-xs text-muted-foreground">{progressPct.toFixed(0)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <MiniStat label="Auto-accepted" value={autoCount} tone="emerald" icon={CheckCircle2} />
            <MiniStat label="Human review" value={humanCount} tone="amber" icon={GitBranch} />
            <MiniStat label="Adj. pass" value={criticPass} tone="emerald" icon={ShieldCheck} />
            <MiniStat label="Adj. fail" value={criticFail} tone="rose" icon={XCircle} />
          </div>
        </CardContent>
      </Card>

      {/* Agent diagram */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> Agent fan-out
          </CardTitle>
          <CardDescription>
            Four specialists in parallel, then fraud reasoning (k=3), an adjudicator, and a job-scoped ring analyst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-stretch gap-3">
            {/* Input node */}
            <DiagramNode
              icon={Layers}
              label="Unit"
              sub="1 event"
              tone="muted"
              active={running}
              count={undefined}
            />
            {/* Fan-out arrows */}
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90 lg:rotate-0" />
            </div>
            {/* Agents */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AGENT_NODES.map((n) => {
                const active = (activeAgents[n.id] ?? 0) > 0;
                const count = totalAgents[n.id] ?? 0;
                return (
                  <DiagramNode
                    key={n.id}
                    icon={n.icon}
                    label={n.label}
                    sub={n.sub}
                    tone={n.tone}
                    active={active}
                    count={count}
                  />
                );
              })}
            </div>
            {/* Merge arrow */}
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90 lg:rotate-0" />
            </div>
            {/* Critic */}
            <DiagramNode
              icon={ShieldCheck}
              label="Adjudicator"
              sub="AGREED / DISPUTED"
              tone="amber"
              active={running}
              count={criticPass + criticFail}
            />
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90 lg:rotate-0" />
            </div>
            <DiagramNode
              icon={Share2}
              label="Ring"
              sub="job graph"
              tone="violet"
              active={(activeAgents.ring_analyst ?? 0) > 0}
              count={totalAgents.ring_analyst}
            />
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90 lg:rotate-0" />
            </div>
            {/* Route */}
            <DiagramNode
              icon={GitBranch}
              label="Route"
              sub="≥0.85 → auto"
              tone="emerald"
              active={running}
              count={done}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Units grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Units</CardTitle>
            <CardDescription>Per-unit pipeline state</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="grid grid-cols-1 gap-2">
                {units.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No units yet. Run the pipeline.
                  </p>
                )}
                {units.map((u) => (
                  <UnitChip key={u.id} unit={u} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Live log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Event log
            </CardTitle>
            <CardDescription>SSE stream · last 200 events</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={logRef} className="h-[360px] overflow-y-auto font-mono text-xs space-y-1 pr-2">
              {logs.length === 0 && (
                <p className="text-muted-foreground py-8 text-center">No events yet.</p>
              )}
              {logs.map((l, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(l.ts).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 w-1.5 h-1.5 rounded-full mt-1.5",
                      l.tone === "ok" && "bg-foreground",
                      l.tone === "warn" && "bg-foreground/50",
                      l.tone === "err" && "bg-rose-500",
                      l.tone === "info" && "bg-primary"
                    )}
                  />
                  <span className={cn(l.tone === "err" && "text-rose-400", l.tone === "warn" && "text-foreground/60")}>
                    {l.text}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {(job.status === "review" || job.status === "done") && (
        <Card className="border-primary/30 glow-emerald">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div>
                <div className="font-medium">Pipeline complete</div>
                <div className="text-sm text-muted-foreground">
                  {autoCount} auto-accepted · {humanCount} routed to human review
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onGoToReview} className="gap-2">
                <GitBranch className="h-4 w-4" /> Review queue
              </Button>
              <Button onClick={onGoToQuality} className="gap-2">
                <Gauge className="h-4 w-4" /> Quality dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run confirmation dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowConfirm(false)}
        >
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Run the pipeline?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{job.filename}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">Units to process</span>
                  <span className="font-mono font-bold">{job.unitCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">Agent calls per unit</span>
                  <span className="font-mono font-bold">4 + 3 + adj + ring</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">Total agent calls</span>
                  <span className="font-mono font-bold">{job.unitCount * 9}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-primary">Est. time</span>
                  <span className="font-mono font-bold text-primary">~{Math.ceil(job.unitCount * 0.5)} min</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Four specialists run in parallel, then fraud reasoning (k=3), the adjudicator, and a job-scoped ring analyst. Route is ≥0.85 → auto, DISPUTED or lower confidence → human.
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-border/60">
                <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={runPipeline} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" /> Run now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DiagramNode({
  icon: Icon,
  label,
  sub,
  tone,
  active,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  tone: "emerald" | "teal" | "violet" | "amber" | "muted";
  active: boolean;
  count: number | undefined;
}) {
  const toneCls = {
    emerald: "border-primary/50 text-primary bg-primary/5",
    teal: "border-foreground/20 text-foreground/80 bg-foreground/5",
    violet: "border-foreground/20 text-foreground/70 bg-foreground/5",
    amber: "border-foreground/20 text-foreground/60 bg-foreground/5",
    muted: "border-border/60 text-muted-foreground bg-muted/30",
  }[tone];
  return (
    <div
      className={cn(
        "relative rounded-xl border p-3 flex flex-col items-center text-center transition-all",
        toneCls,
        active && "animate-pulse-ring scale-[1.02]"
      )}
    >
      <Icon className={cn("h-5 w-5 mb-1", active && "drop-shadow-[0_0_8px_currentColor]")} />
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      {count !== undefined && count > 0 && (
        <div className="absolute -top-2 -right-2 bg-card border border-border rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-mono font-bold">
          {count}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "teal";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneCls = {
    emerald: "text-foreground",
    amber: "text-foreground/60",
    rose: "text-rose-400",
    teal: "text-foreground/80",
  }[tone];
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", toneCls)} />
      <div>
        <div className={cn("text-lg font-bold tabular-nums leading-none", toneCls)}>{value}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function UnitChip({ unit }: { unit: UnitState }) {
  const tone =
    unit.route === "auto"
      ? "border-foreground/30 bg-foreground/5"
      : unit.route === "human"
      ? "border-foreground/20 bg-foreground/5"
      : unit.status === "labeling"
      ? "border-primary/40 bg-primary/5"
      : "border-border/60";
  return (
    <div className={cn("flex items-center gap-3 p-2.5 rounded-lg border text-sm", tone)}>
      <span className="font-mono text-xs text-muted-foreground w-8">#{unit.seq}</span>
      {unit.isHoneypot && <AlertTriangle className="h-3 w-3 text-foreground/60" />}
      <div className="flex-1 min-w-0">
        {unit.status === "labeling" && (
          <span className="text-xs text-primary flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> labeling · attempt {unit.attempt}
          </span>
        )}
        {unit.status === "pending" && <span className="text-xs text-muted-foreground">pending</span>}
        {unit.status === "labeled" && unit.route && (
          <span className={cn("text-xs", unit.route === "auto" ? "text-foreground" : "text-foreground/60")}>
            {unit.route === "auto" ? "auto-accept" : "human review"} · conf {unit.confidence?.toFixed(2)}
          </span>
        )}
        {unit.status === "reviewed" && <span className="text-xs text-foreground">reviewed</span>}
      </div>
      <span className="text-[10px] text-muted-foreground font-mono">{unit.draftCount} drafts</span>
    </div>
  );
}
