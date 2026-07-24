"use client";

import { useCallback, useEffect, useState } from "react";
import type { Job, ReviewItem } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import type { Draft } from "@/lib/types";
import { toast } from "sonner";
import {
  Check,
  Edit3,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Loader2,
  GitBranch,
  ShieldCheck,
  Bot,
  Gauge,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      if (idx >= queue.length) setIdx(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [job.id, idx]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  // load drafts for current item
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
      toast.info("No unreviewed units to batch process.");
      return;
    }
    if (!confirm(`${action === "accept" ? "Accept" : "Reject"} all ${unreviewed.length} unreviewed units?`)) return;
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
    if (ok > 0) toast.success(`${ok} unit${ok !== 1 ? "s" : ""} ${action}ed`);
    if (fail > 0) toast.error(`${fail} failed`);
    setRefreshTick((t) => t + 1);
  };

  // keyboard shortcuts: A accept, E edit-mode, R reject, J/K navigate
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
            Low-confidence units (conf &lt; 0.85) routed here. Keys: <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">A</kbd> accept ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">E</kbd> edit ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">R</kbd> reject ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">J</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">K</kbd> nav
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
            <p className="text-muted-foreground">No units routed to human review for this job.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run the pipeline first, or all units auto-accepted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5">
          {/* Queue list */}
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
                          <div className="text-xs truncate">{it.payload.chapter}</div>
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
                        <span className={cn(it.payload.difficulty)}>{it.payload.difficulty}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Detail pane */}
          {current && (
            <div className="space-y-4">
              {/* Nav */}
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
                  <Button size="sm" variant="ghost" onClick={() => setIdx((i) => Math.min(i + 1, items.length - 1))} disabled={idx === items.length - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Left: question + drafts (the differentiator) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" /> Question & agent drafts
                    </CardTitle>
                    <CardDescription>See exactly where agents disagreed.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Stem</Label>
                      <div className="mt-1 p-3 rounded-lg bg-muted/40 border border-border/60 text-sm leading-relaxed">
                        {current.stem}
                      </div>
                      {current.options && (
                        <div className="mt-2 space-y-1">
                          {current.options.map((o, i) => (
                            <div key={i} className="text-xs font-mono text-muted-foreground pl-3">
                              ({String.fromCharCode(97 + i)}) {o}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Separator />
                    <DraftsPanel drafts={drafts} />
                  </CardContent>
                </Card>

                {/* Right: editable annotation form */}
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
                        <Label htmlFor="note" className="text-xs">Review note (optional)</Label>
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
                      <Button onClick={() => submit("accept")} disabled={submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-foreground">
                        <Check className="h-4 w-4" /> Accept <kbd className="ml-1 text-[10px] opacity-70">A</kbd>
                      </Button>
                      {!editMode ? (
                        <Button onClick={() => { setEdited(current.payload); setEditMode(true); }} disabled={submitting} variant="outline" className="gap-2">
                          <Edit3 className="h-4 w-4" /> Edit <kbd className="ml-1 text-[10px] opacity-70">E</kbd>
                        </Button>
                      ) : (
                        <Button onClick={() => submit("edit")} disabled={submitting} className="gap-2 bg-teal-600 hover:bg-teal-700 text-foreground">
                          <Check className="h-4 w-4" /> Save edit <kbd className="ml-1 text-[10px] opacity-70">E</kbd>
                        </Button>
                      )}
                      <Button onClick={() => submit("reject")} disabled={submitting} variant="outline" className="gap-2 border-rose-500/40 text-rose-400 hover:bg-rose-500/10">
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
      {(["taxonomy", "difficulty", "math", "language", "critic"] as const).map((agent) => {
        const ds = byAgent[agent] ?? [];
        if (ds.length === 0) return null;
        return <DraftGroup key={agent} agent={agent} drafts={ds} />;
      })}
    </div>
  );
}

function DraftGroup({ agent, drafts }: { agent: string; drafts: Draft[] }) {
  const [open, setOpen] = useState(agent === "taxonomy" || agent === "difficulty");
  // detect disagreement for sampled agents
  const values = drafts.map((d) => {
    const p = d.payload as Record<string, unknown>;
    if (agent === "taxonomy") return p.chapter as string;
    if (agent === "difficulty") return p.difficulty as string;
    return JSON.stringify(p);
  });
  const disagree = new Set(values).size > 1;

  const icon = {
    taxonomy: Bot,
    difficulty: Gauge,
    math: Bot,
    language: Bot,
    critic: ShieldCheck,
  }[agent] ?? Bot;

  const Icon = icon;

  return (
    <div className={cn("rounded-lg border", disagree ? "border-foreground/20 bg-foreground/5" : "border-border/60")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-2.5 text-left"
      >
        <Icon className={cn("h-3.5 w-3.5", disagree ? "text-foreground/60" : "text-muted-foreground")} />
        <span className="text-xs font-semibold capitalize">{agent}</span>
        <span className="text-[10px] text-muted-foreground">· {drafts.length} sample{drafts.length !== 1 ? "s" : ""}</span>
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
                {agent === "taxonomy" && (
                  <div>
                    <span className="text-muted-foreground">sample {d.sampleIdx}:</span>{" "}
                    <span className="text-primary">{String(p.chapter)}</span>
                    {Array.isArray(p.concepts) && (
                      <span className="text-muted-foreground"> · [{(p.concepts as string[]).join(", ")}]</span>
                    )}
                  </div>
                )}
                {agent === "difficulty" && (
                  <div>
                    <span className="text-muted-foreground">sample {d.sampleIdx}:</span>{" "}
                    <span className="text-foreground/80">{String(p.difficulty)}</span>{" "}
                    <span className="text-muted-foreground">· {String(p.bloom)}</span>
                    <div className="text-muted-foreground mt-0.5 italic">"{String(p.difficulty_rationale).slice(0, 120)}"</div>
                  </div>
                )}
                {agent === "math" && (
                  <div>
                    has_equation: <span className="text-foreground/60">{String(p.has_equation)}</span>
                    {Array.isArray(p.latex) && (p.latex as string[]).length > 0 && (
                      <div className="mt-0.5 text-primary">{(p.latex as string[]).join("  ·  ")}</div>
                    )}
                  </div>
                )}
                {agent === "language" && (
                  <div>
                    <span className="text-foreground/70">{String(p.language)}</span>
                    <span className="text-muted-foreground"> · code_mix {Number(p.code_mix_ratio).toFixed(2)}</span>
                  </div>
                )}
                {agent === "critic" && (
                  <div>
                    passed: <span className={p.passed ? "text-foreground" : "text-rose-400"}>{String(p.passed)}</span>
                    {Array.isArray(p.failures) && (p.failures as string[]).length > 0 && (
                      <div className="mt-0.5 text-rose-400">{(p.failures as string[]).join("; ")}</div>
                    )}
                  </div>
                )}
                {d.latencyMs != null && (
                  <div className="text-[9px] text-muted-foreground mt-0.5">{d.latencyMs}ms</div>
                )}
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
          <Label className="text-xs text-muted-foreground">Chapter</Label>
          <Input value={payload.chapter} readOnly={!editable} onChange={(e) => set({ chapter: e.target.value })} className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Difficulty</Label>
          <Select value={payload.difficulty} onValueChange={(v) => set({ difficulty: v as ReviewItem["payload"]["difficulty"] })} disabled={!editable}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">easy</SelectItem>
              <SelectItem value="medium">medium</SelectItem>
              <SelectItem value="hard">hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bloom level</Label>
          <Select value={payload.bloom} onValueChange={(v) => set({ bloom: v as ReviewItem["payload"]["bloom"] })} disabled={!editable}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="remember">remember</SelectItem>
              <SelectItem value="understand">understand</SelectItem>
              <SelectItem value="apply">apply</SelectItem>
              <SelectItem value="analyze">analyze</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Language</Label>
          <Select value={payload.language} onValueChange={(v) => set({ language: v as ReviewItem["payload"]["language"] })} disabled={!editable}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">en</SelectItem>
              <SelectItem value="hi">hi</SelectItem>
              <SelectItem value="hinglish">hinglish</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Concepts (comma separated)</Label>
        <Input
          value={payload.concepts.join(", ")}
          readOnly={!editable}
          onChange={(e) => set({ concepts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Difficulty rationale</Label>
        <Textarea
          value={payload.difficulty_rationale}
          readOnly={!editable}
          onChange={(e) => set({ difficulty_rationale: e.target.value })}
          className="text-sm"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Has equation</Label>
          <Select value={String(payload.has_equation)} onValueChange={(v) => set({ has_equation: v === "true" })} disabled={!editable}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Code-mix ratio</Label>
          <Input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={payload.code_mix_ratio}
            readOnly={!editable}
            onChange={(e) => set({ code_mix_ratio: parseFloat(e.target.value) || 0 })}
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">LaTeX (one per line)</Label>
        <Textarea
          value={payload.latex.join("\n")}
          readOnly={!editable}
          onChange={(e) => set({ latex: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          className="text-sm font-mono"
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
          <span className="text-muted-foreground">route:</span>{" "}
          <span className={cn("font-mono", payload.route === "auto" ? "text-foreground" : "text-foreground/60")}>{payload.route}</span>
        </div>
      </div>
    </div>
  );
}
