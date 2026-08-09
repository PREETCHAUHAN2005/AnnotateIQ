"use client";

import { useEffect, useState } from "react";
import type { HoneypotResult, Job } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
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
    setLoading(true);
    api
      .getHoneypots(job.id)
      .then((r) => {
        if (cancelled) return;
        setItems(r.honeypots);
        setSelected(r.honeypots[0] ?? null);
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
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-12 text-center">
          <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No honeypot units in this job.</p>
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
  const fieldAccuracy =
    allFields.length > 0 ? allFields.filter((d) => d.match).length / allFields.length : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" /> Honeypot Inspector
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gold labels vs agent predictions — field-level verification.
        </p>
      </div>

      {/* Compact KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryChip label="Honeypots" value={items.length} icon={FlaskConical} />
        <SummaryChip label="Passed" value={passCount} icon={CheckCircle2} tone="ok" />
        <SummaryChip label="Failed" value={failCount} icon={XCircle} tone="bad" />
        <SummaryChip label="Field accuracy" value={`${Math.round(fieldAccuracy * 100)}%`} icon={Target} />
      </div>

      {/* Slim accuracy bar */}
      <Card className="border-border/60">
        <CardContent className="py-3 px-4 flex items-center gap-4">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs text-muted-foreground">Overall honeypot accuracy</span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  accuracy >= 0.8 ? "text-foreground" : accuracy >= 0.5 ? "text-foreground/70" : "text-rose-400"
                )}
              >
                {Math.round(accuracy * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  accuracy >= 0.8 ? "bg-foreground" : accuracy >= 0.5 ? "bg-foreground/50" : "bg-rose-500"
                )}
                style={{ width: `${accuracy * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Narrow list + capped detail */}
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="py-3 px-3 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Units ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain space-y-1">
              {items.map((item) => {
                const outcome =
                  item.event?.kind === "honeypot_pass"
                    ? "pass"
                    : item.event?.kind === "honeypot_fail"
                      ? "fail"
                      : "pending";
                const isActive = selected?.unitId === item.unitId;
                const matchCount = item.diffs.filter((d) => d.match).length;
                return (
                  <button
                    key={item.unitId}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-md border transition",
                      isActive
                        ? "border-primary/40 bg-primary/5"
                        : "border-transparent hover:bg-accent/40 hover:border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">#{item.seq}</span>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          outcome === "pass" && "bg-foreground",
                          outcome === "fail" && "bg-rose-500",
                          outcome === "pending" && "bg-muted-foreground/40"
                        )}
                      />
                      <span className="text-[11px] truncate flex-1 font-medium">
                        {item.predicted?.chapter ? String(item.predicted.chapter) : "—"}
                      </span>
                      {outcome === "pass" ? (
                        <CheckCircle2 className="h-3 w-3 text-foreground shrink-0" />
                      ) : outcome === "fail" ? (
                        <XCircle className="h-3 w-3 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground pl-5">
                      conf {item.confidence?.toFixed(2) ?? "—"} ·{" "}
                      <span className={cn(matchCount === item.diffs.length ? "text-foreground" : "text-rose-400")}>
                        {matchCount}/{item.diffs.length} match
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {selected && (
          <Card className="border-border/60 max-w-2xl">
            <CardHeader className="py-3 px-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-primary" />
                  Honeypot #{selected.seq}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-[10px] h-6",
                    selected.event?.kind === "honeypot_pass" && "border-foreground/30 text-foreground",
                    selected.event?.kind === "honeypot_fail" && "border-rose-500/40 text-rose-400",
                    !selected.event && "border-border text-muted-foreground"
                  )}
                >
                  {selected.event?.kind === "honeypot_pass" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> PASSED
                    </>
                  ) : selected.event?.kind === "honeypot_fail" ? (
                    <>
                      <XCircle className="h-3 w-3" /> FAILED
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" /> PENDING
                    </>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs">Gold vs predicted · field-level diff</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Question stem</div>
                <div className="p-2.5 rounded-md bg-muted/40 border border-border/50 text-xs leading-relaxed max-h-28 overflow-y-auto">
                  {selected.stem}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Field comparison
                </div>
                <div className="rounded-md border border-border/60 overflow-hidden divide-y divide-border/50">
                  {selected.diffs.map((d) => (
                    <div
                      key={d.field}
                      className={cn(
                        "grid grid-cols-[72px_1fr_1fr_20px] gap-2 items-start px-2.5 py-2 text-xs",
                        d.match ? "bg-background" : "bg-rose-500/[0.04]"
                      )}
                    >
                      <div className="font-medium capitalize text-muted-foreground pt-3">{d.field}</div>
                      <div className="min-w-0">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Gold</div>
                        <div className="font-mono text-[11px] leading-snug break-words">{d.gold || "—"}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
                          Predicted
                        </div>
                        <div
                          className={cn(
                            "font-mono text-[11px] leading-snug break-words",
                            !d.match && "text-rose-400 font-semibold"
                          )}
                        >
                          {d.predicted || "—"}
                        </div>
                      </div>
                      <div className="pt-3">
                        {d.match ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <MetaCell label="Confidence" value={selected.confidence?.toFixed(2) ?? "—"} />
                <MetaCell
                  label="Route"
                  value={selected.route ?? "—"}
                  className={selected.route === "auto" ? "text-foreground" : "text-foreground/60"}
                />
                <MetaCell label="Review" value={selected.reviewerAction ?? "unreviewed"} />
              </div>

              {selected.event?.detail && (
                <>
                  <Separator />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Event detail
                    </div>
                    <pre className="text-[10px] font-mono p-2 rounded-md bg-muted/40 border border-border/50 overflow-x-auto max-h-24">
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

function SummaryChip({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <div
        className={cn(
          "rounded-md p-1.5 shrink-0",
          tone === "ok" && "bg-foreground/10 text-foreground",
          tone === "bad" && "bg-rose-500/10 text-rose-400",
          !tone && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        <div
          className={cn(
            "text-sm font-bold tabular-nums",
            tone === "bad" && "text-rose-400"
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-xs mt-0.5 capitalize", className)}>{value}</div>
    </div>
  );
}
