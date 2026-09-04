"use client";

import { useCallback, useEffect, useState } from "react";
import type { Draft, Job, ReviewItem } from "@/lib/types";
import { api } from "@/lib/api";
import { eventSummary, parseUnitEvent } from "@/lib/normalize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Check,
  Edit3,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Bot,
  Gauge,
  CheckCircle2,
  XCircle,
  Cpu,
  Layers,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_LABELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const ACTIONS = ["ALLOW", "REVIEW", "STEP_UP_VERIFICATION", "HOLD", "REJECT"] as const;
const AGENT_ORDER = [
  "transaction_risk",
  "behavioral",
  "device_network",
  "merchant_order",
  "fraud_reasoning",
  "adjudicator",
] as const;

export function ReviewView({ job }: { job: Job }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState<ReviewItem["payload"] | null>(null);
  const [note, setNote] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { queue } = await api.getReviewQueue(job.id, false);
      setItems(queue);
      setIdx((prev) => (prev >= queue.length ? 0 : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  useEffect(() => {
    if (!items[idx]) return;
    setEditMode(false);
    setEdited(null);
    setNote("");
    api
      .getDrafts(job.id, items[idx].unitId)
      .then((r) => setDrafts(r.drafts))
      .catch(() => setDrafts([]));
  }, [job.id, items, idx]);

  const current = items[idx];

  const submit = async (action: "accept" | "edit" | "reject") => {
    if (!current) return;
    if (action === "edit" && !edited) {
      toast.error("Make edits first or use Accept.");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReview(current.unitId, {
        action,
        editedPayload: action === "edit" ? edited : undefined,
        note: note || undefined,
        reviewer: "reviewer",
      });
      toast.success(action === "accept" ? "Accepted" : action === "edit" ? "Edited & accepted" : "Rejected");
      setRefreshTick((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const batchAction = async (action: "accept" | "reject") => {
    const unreviewed = items.filter((i) => !i.reviewerAction);
    if (unreviewed.length === 0) {
      toast.info("No unreviewed events to batch process.");
      return;
    }
    if (!confirm(`${action === "accept" ? "Accept" : "Reject"} all ${unreviewed.length} unreviewed events?`)) return;
    setSubmitting(true);
    let ok = 0;
    let fail = 0;
    for (const item of unreviewed) {
      try {
        await api.submitReview(item.unitId, { action, reviewer: "reviewer" });
        ok++;
      } catch {
        fail++;
      }
    }
    setSubmitting(false);
    if (ok > 0) toast.success(`${ok} event${ok !== 1 ? "s" : ""} ${action}ed`);
    if (fail > 0) toast.error(`${fail} failed`);
    setRefreshTick((t) => t + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "a") submit("accept");
      else if (k === "r") submit("reject");
      else if (k === "e") {
        if (!editMode) {
          setEdited(current?.payload ?? null);
          setEditMode(true);
        }
      } else if (k === "j") setIdx((i) => Math.min(i + 1, items.length - 1));
      else if (k === "k") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, editMode, items.length]);

  const reviewedCount = items.filter((i) => i.reviewerAction).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Low-confidence or DISPUTED events (conf &lt; 0.85) route here. Keys:{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">A</kbd> accept ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">E</kbd> edit ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">R</kbd> reject ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">J</kbd>/
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">K</kbd> nav
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1.5">
            {reviewedCount} / {items.length} reviewed
          </Badge>
          {items.length > 0 && reviewedCount < items.length && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchAction("accept")}
                disabled={submitting}
                className="gap-1.5 border-foreground/30 text-foreground hover:bg-foreground/10"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept all
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchAction("reject")}
                disabled={submitting}
                className="gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject all
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Check className="h-10 w-10 text-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No events routed to human review for this job.</p>
            <p className="text-xs text-muted-foreground mt-1">Run the pipeline first, or all events auto-accepted.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Queue ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-1 p-3 pt-0">
                  {items.map((it, i) => (
                    <button
                      key={it.id}
                      onClick={() => setIdx(i)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-lg border transition",
                        i === idx ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-accent/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{it.seq}</span>
                        {it.isHoneypot && <AlertTriangle className="h-3 w-3 text-foreground/60" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate font-mono">{it.payload.risk_label}</div>
                        </div>
                        {it.reviewerAction && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0",
                              it.reviewerAction === "accept" && "border-foreground/30 text-foreground",
                              it.reviewerAction === "edit" && "border-foreground/20 text-foreground/80",
                              it.reviewerAction === "reject" && "border-rose-500/40 text-rose-400"
                            )}
                          >
                            {it.reviewerAction}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>conf {it.confidence.toFixed(2)}</span>
                        <span>·</span>
                        <span className={cn(it.payload.consensus === "DISPUTED" && "text-rose-400")}>
                          {it.payload.recommended_action}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {current && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Item {idx + 1} of {items.length}
                  </span>
                  {current.isHoneypot && (
                    <Badge variant="outline" className="gap-1 border-foreground/20 text-foreground/60">
                      <AlertTriangle className="h-3 w-3" /> honeypot
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setIdx((i) => Math.max(i - 1, 0))} disabled={idx === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIdx((i) => Math.min(i + 1, items.length - 1))}
                    disabled={idx === items.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" /> Event & agent drafts
                    </CardTitle>
                    <CardDescription>See exactly where specialists disagreed.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Payment event</Label>
                      <div className="mt-1 p-3 rounded-lg bg-muted/40 border border-border/60 text-sm leading-relaxed font-mono">
                        {eventSummary(current.payload.event ?? parseUnitEvent(current.stem, current.stem))}
                      </div>
                    </div>
                    <Separator />
                    <DraftsPanel drafts={drafts} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-primary" /> Annotation
                    </CardTitle>
                    <CardDescription>
                      {editMode ? "Editing — fields are editable." : "Read-only. Press E to edit."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <AnnotationForm
                      payload={editMode && edited ? edited : current.payload}
                      editable={editMode}
                      onChange={editMode ? setEdited : undefined}
                    />
                    {editMode && (
                      <div className="space-y-1">
                        <Label htmlFor="note" className="text-xs">
                          Review note (optional)
                        </Label>
                        <Textarea
                          id="note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Why this edit?"
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                    )}
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => submit("accept")}
                        disabled={submitting}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="h-4 w-4" /> Accept <kbd className="ml-1 text-[10px] opacity-70">A</kbd>
                      </Button>
                      {!editMode ? (
                        <Button
                          onClick={() => {
                            setEdited(current.payload);
                            setEditMode(true);
                          }}
                          disabled={submitting}
                          variant="outline"
                          className="gap-2"
                        >
                          <Edit3 className="h-4 w-4" /> Edit <kbd className="ml-1 text-[10px] opacity-70">E</kbd>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => submit("edit")}
                          disabled={submitting}
                          className="gap-2 bg-teal-600 hover:bg-teal-700 text-foreground"
                        >
                          <Check className="h-4 w-4" /> Save edit <kbd className="ml-1 text-[10px] opacity-70">E</kbd>
                        </Button>
                      )}
                      <Button
                        onClick={() => submit("reject")}
                        disabled={submitting}
                        variant="outline"
                        className="gap-2 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                      >
                        <X className="h-4 w-4" /> Reject <kbd className="ml-1 text-[10px] opacity-70">R</kbd>
                      </Button>
                    </div>
                    {current.reviewerAction && (
                      <div className="text-xs text-muted-foreground pt-2">
                        Already reviewed: <span className="text-foreground">{current.reviewerAction}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DraftsPanel({ drafts }: { drafts: Draft[] }) {
  const byAgent: Record<string, Draft[]> = {};
  for (const d of drafts) (byAgent[d.agent] ??= []).push(d);

  return (
    <div className="space-y-3">
      {AGENT_ORDER.map((agent) => {
        const ds = byAgent[agent] ?? [];
        if (ds.length === 0) return null;
        return <DraftGroup key={agent} agent={agent} drafts={ds} />;
      })}
    </div>
  );
}

function draftKey(agent: string, p: Record<string, unknown>): string {
  if (agent === "transaction_risk") return String(p.transaction_risk);
  if (agent === "behavioral") return `${p.behavior_anomaly}:${p.behavioral_pattern}`;
  if (agent === "device_network") return String(p.device_risk);
  if (agent === "merchant_order") return String(p.merchant_context_risk);
  if (agent === "fraud_reasoning") return `${p.risk_label}:${p.recommended_action}`;
  if (agent === "adjudicator") return `${p.consensus}:${p.final_label}`;
  return JSON.stringify(p);
}

function DraftGroup({ agent, drafts }: { agent: string; drafts: Draft[] }) {
  const [open, setOpen] = useState(agent === "fraud_reasoning" || agent === "adjudicator");
  const values = drafts.map((d) => draftKey(agent, d.payload as Record<string, unknown>));
  const disagree = new Set(values).size > 1;

  const icon = {
    transaction_risk: Gauge,
    behavioral: Activity,
    device_network: Cpu,
    merchant_order: Layers,
    fraud_reasoning: Bot,
    adjudicator: ShieldCheck,
  }[agent] ?? Bot;
  const Icon = icon;

  return (
    <div className={cn("rounded-lg border", disagree ? "border-foreground/20 bg-foreground/5" : "border-border/60")}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 p-2.5 text-left">
        <Icon className={cn("h-3.5 w-3.5", disagree ? "text-foreground/60" : "text-muted-foreground")} />
        <span className="text-xs font-semibold">{agent}</span>
        <span className="text-[10px] text-muted-foreground">
          · {drafts.length} sample{drafts.length !== 1 ? "s" : ""}
        </span>
        {disagree && (
          <Badge variant="outline" className="text-[9px] ml-1 border-foreground/20 text-foreground/60 gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> disagreed
          </Badge>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {drafts.map((d) => {
            const p = d.payload as Record<string, unknown>;
            return (
              <div key={d.id} className="text-xs font-mono p-2 rounded bg-muted/40 border border-border/40">
                {agent === "transaction_risk" && (
                  <div>
                    sample {d.sampleIdx}: <span className="text-primary">{String(p.transaction_risk)}</span>
                  </div>
                )}
                {agent === "behavioral" && (
                  <div>
                    anomaly {String(p.behavior_anomaly)} · {String(p.behavioral_pattern)}
                  </div>
                )}
                {agent === "device_network" && <div>device_risk {String(p.device_risk)}</div>}
                {agent === "merchant_order" && <div>merchant_context_risk {String(p.merchant_context_risk)}</div>}
                {agent === "fraud_reasoning" && (
                  <div>
                    <span className="text-muted-foreground">sample {d.sampleIdx}:</span>{" "}
                    <span className="text-primary">{String(p.risk_label)}</span> · {String(p.recommended_action)}
                    {p.explanation != null && (
                      <div className="text-muted-foreground mt-0.5 italic">
                        &quot;{String(p.explanation).slice(0, 140)}&quot;
                      </div>
                    )}
                  </div>
                )}
                {agent === "adjudicator" && (
                  <div>
                    passed: <span className={p.passed ? "text-foreground" : "text-rose-400"}>{String(p.passed)}</span> ·{" "}
                    {String(p.consensus)} · {String(p.final_label)}
                    {Array.isArray(p.failures) && (p.failures as string[]).length > 0 && (
                      <div className="mt-0.5 text-rose-400">{(p.failures as string[]).join("; ")}</div>
                    )}
                  </div>
                )}
                {d.latencyMs != null && <div className="text-[9px] text-muted-foreground mt-0.5">{d.latencyMs}ms</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnnotationForm({
  payload,
  editable,
  onChange,
}: {
  payload: ReviewItem["payload"];
  editable: boolean;
  onChange?: (p: ReviewItem["payload"]) => void;
}) {
  const set = (patch: Partial<ReviewItem["payload"]>) => onChange?.({ ...payload, ...patch });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Risk label</Label>
          <Select
            value={payload.risk_label}
            onValueChange={(v) => set({ risk_label: v as ReviewItem["payload"]["risk_label"], final_label: v as ReviewItem["payload"]["final_label"] })}
            disabled={!editable}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_LABELS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Recommended action</Label>
          <Select
            value={payload.recommended_action}
            onValueChange={(v) => set({ recommended_action: v as ReviewItem["payload"]["recommended_action"] })}
            disabled={!editable}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Explanation</Label>
        <Textarea
          value={payload.explanation}
          readOnly={!editable}
          onChange={(e) => set({ explanation: e.target.value })}
          className="text-sm"
          rows={3}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Risk factors (comma separated)</Label>
        <Textarea
          value={(payload.risk_factors ?? []).join(", ")}
          readOnly={!editable}
          onChange={(e) =>
            set({
              risk_factors: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="text-sm"
          rows={2}
        />
      </div>
      <div className="flex items-center gap-4 pt-1">
        <div className="text-xs">
          <span className="text-muted-foreground">confidence:</span>{" "}
          <span className="font-mono text-primary">{payload.confidence.toFixed(2)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">agreement:</span>{" "}
          <span className="font-mono text-foreground/80">{payload.agreement.toFixed(2)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">consensus:</span>{" "}
          <span className={cn("font-mono", payload.consensus === "DISPUTED" ? "text-rose-400" : "text-foreground")}>
            {payload.consensus}
          </span>
        </div>
      </div>
    </div>
  );
}
