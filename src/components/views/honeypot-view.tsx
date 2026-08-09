"use client";

import { useEffect, useState } from "react";
import type { HoneypotResult, Job } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Target,
  AlertTriangle,
  Sparkles,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function HoneypotView({ job }: { job: Job }) {
  const [items, setItems] = useState<HoneypotResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HoneypotResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getHoneypots(job.id)
      .then((r) => {
        if (cancelled) return;
        setItems(r.honeypots);
        if (r.honeypots.length > 0) setSelected(r.honeypots[0]);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FlaskConical className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No honeypot units in this job.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Honeypots are seeded automatically when a job is created from a sample paper.
          </p>
        </CardContent>
      </Card>
    );
  }

  const passCount = items.filter((i) => i.event?.kind === "honeypot_pass").length;
  const failCount = items.filter((i) => i.event?.kind === "honeypot_fail").length;
  const accuracy = items.length > 0 ? passCount / items.length : 0;
  const allFields = items.flatMap((i) => i.diffs);
  const fieldAccuracy = allFields.length > 0
    ? allFields.filter((d) => d.match).length / allFields.length
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" /> Honeypot Inspector
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Externally verifiable quality — gold labels vs agent predictions, field by field.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total honeypots" value={items.length} icon={FlaskConical} tone="primary" />
        <SummaryCard label="Passed" value={passCount} icon={CheckCircle2} tone="emerald" />
        <SummaryCard label="Failed" value={failCount} icon={XCircle} tone="rose" />
        <SummaryCard label="Field accuracy" value={`${Math.round(fieldAccuracy * 100)}%`} icon={Target} tone="amber" />
      </div>

      {/* Overall accuracy bar */}
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Overall honeypot accuracy
            </span>
            <span className={cn("text-2xl font-bold tabular-nums", accuracy >= 0.8 ? "text-foreground" : accuracy >= 0.5 ? "text-foreground/60" : "text-rose-400")}>
              {Math.round(accuracy * 100)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500", accuracy >= 0.8 ? "bg-foreground" : accuracy >= 0.5 ? "bg-foreground/50" : "bg-rose-500")}
              style={{ width: `${accuracy * 100}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            This is the only externally verifiable quality number. It matters more than anything else on the dashboard.
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        {/* Honeypot list */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Honeypot units ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-3 pt-0">
                {items.map((item) => {
                  const outcome =
                    item.event?.kind === "honeypot_pass"
                      ? "pass"
                      : item.event?.kind === "honeypot_fail"
                        ? "fail"
                        : "pending";
                  const isActive = selected?.unitId === item.unitId;
                  return (
                    <button
                      key={item.unitId}
                      onClick={() => setSelected(item)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-lg border transition",
                        isActive ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-accent/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{item.seq}</span>
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            outcome === "pass" && "bg-foreground",
                            outcome === "fail" && "bg-rose-500",
                            outcome === "pending" && "bg-muted-foreground/50"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate">
                            {item.predicted?.chapter ? String(item.predicted.chapter) : "—"}
                          </div>
                        </div>
                        {outcome === "pass" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0" />
                        ) : outcome === "fail" ? (
                          <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>conf {item.confidence?.toFixed(2) ?? "—"}</span>
                        <span>·</span>
                        <span className={cn(item.diffs.every((d) => d.match) ? "text-foreground" : "text-rose-400")}>
                          {item.diffs.filter((d) => d.match).length}/{item.diffs.length} fields match
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail pane */}
        {selected && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Honeypot #{selected.seq}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1",
                    selected.event?.kind === "honeypot_pass" && "border-foreground/30 text-foreground",
                    selected.event?.kind === "honeypot_fail" && "border-rose-500/40 text-rose-400",
                    !selected.event && "border-border text-muted-foreground"
                  )}
                >
                  {selected.event?.kind === "honeypot_pass" ? (
                    <><CheckCircle2 className="h-3 w-3" /> PASSED</>
                  ) : selected.event?.kind === "honeypot_fail" ? (
                    <><XCircle className="h-3 w-3" /> FAILED</>
                  ) : (
                    <><Clock className="h-3 w-3" /> PENDING</>
                  )}
                </Badge>
              </div>
              <CardDescription>Gold label vs agent prediction — field-level diff</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stem */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Question stem</div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-sm leading-relaxed">
                  {selected.stem}
                </div>
              </div>

              <Separator />

              {/* Field-by-field diff table */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Field comparison</div>
                <div className="space-y-2">
                  {selected.diffs.map((d) => (
                    <div
                      key={d.field}
                      className={cn(
                        "grid grid-cols-[100px_1fr_1fr_24px] gap-3 items-center p-2.5 rounded-lg border",
                        d.match ? "border-foreground/20 bg-foreground/5" : "border-rose-500/30 bg-rose-500/5"
                      )}
                    >
                      <div className="text-xs font-medium capitalize text-muted-foreground">{d.field}</div>
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Gold</div>
                        <div className="text-sm font-mono">{d.gold || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Predicted</div>
                        <div className={cn("text-sm font-mono", !d.match && "text-rose-400 font-bold")}>{d.predicted || "—"}</div>
                      </div>
                      <div>
                        {d.match ? (
                          <CheckCircle2 className="h-4 w-4 text-foreground" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Additional fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="text-sm font-mono text-primary">{selected.confidence?.toFixed(2) ?? "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Route</div>
                  <div className={cn("text-sm font-mono", selected.route === "auto" ? "text-foreground" : "text-foreground/60")}>
                    {selected.route ?? "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Review status</div>
                  <div className="text-sm">{selected.reviewerAction ?? "unreviewed"}</div>
                </div>
              </div>

              {/* Event detail */}
              {selected.event?.detail && (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> Event detail
                    </div>
                    <pre className="text-xs font-mono p-2 rounded bg-muted/40 overflow-x-auto">
                      {selected.event.detail}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "emerald" | "rose" | "amber";
}) {
  const toneCls = {
    primary: "text-primary bg-primary/10",
    emerald: "text-foreground bg-foreground/10",
    rose: "text-rose-400 bg-rose-500/10",
    amber: "text-foreground/60 bg-foreground/10",
  }[tone];
  return (
    <Card className="border-border/60 card-hover animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className={cn("rounded-md p-1.5", toneCls)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className={cn("text-2xl font-bold tabular-nums", toneCls.split(" ")[0])}>{value}</div>
      </CardContent>
    </Card>
  );
}
