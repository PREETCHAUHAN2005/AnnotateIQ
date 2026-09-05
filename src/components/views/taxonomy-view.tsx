"use client";

import { useEffect, useState } from "react";
import type { LabelStat, TaxonomyStats } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import {
  BookOpen,
  Loader2,
  Search,
  Layers,
  TrendingUp,
  CheckCircle2,
  Circle,
  ChevronRight,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import taxonomy from "@/lib/data/taxonomy.json";

export function TaxonomyView() {
  const [stats, setStats] = useState<TaxonomyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LabelStat | null>(null);
  const [filter, setFilter] = useState<"all" | "covered" | "uncovered">("all");

  useEffect(() => {
    let cancelled = false;
    api
      .getTaxonomy()
      .then((r) => {
        if (cancelled) return;
        setStats(r);
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">No risk taxonomy data yet.</CardContent>
      </Card>
    );
  }

  const filtered = stats.labels.filter((c) => {
    if (filter === "covered" && c.count === 0) return false;
    if (filter === "uncovered" && c.count > 0) return false;
    if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const coverageData = stats.labels
    .filter((c) => c.count > 0)
    .map((c) => ({
      name: c.name,
      events: c.count,
      auto: c.autoCount,
      human: c.humanCount,
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Risk taxonomy
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {stats.coveredLabels} of {stats.totalLabels} risk labels seen across {stats.totalEvents} annotated events.
          Failure jobs also use a closed failure_reason / retryability set.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failure closed sets</CardTitle>
          <CardDescription>Used on Job.kind=failure. Chargeback stays a field, not a job type.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {[
            { label: "failure_reason", values: taxonomy.failure_reasons },
            { label: "retryability", values: taxonomy.retryability },
            { label: "routing_implication", values: taxonomy.routing_implications },
            { label: "likely_resolution", values: taxonomy.likely_resolutions },
          ].map((row) => (
            <div key={row.label}>
              <div className="text-xs font-mono text-primary mb-1.5">{row.label}</div>
              <div className="flex flex-wrap gap-1">
                {row.values.map((v) => (
                  <Badge key={v} variant="outline" className="text-[10px] font-mono">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Risk labels</span>
              <div className="rounded-md p-1.5 bg-primary/10 text-primary">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums">{stats.totalLabels}</div>
          </CardContent>
        </Card>
        <Card className="border-foreground/20 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground uppercase tracking-wider">Covered</span>
              <div className="rounded-md p-1.5 bg-foreground/10 text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">{stats.coveredLabels}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-400/20 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground/60 uppercase tracking-wider">Uncovered</span>
              <div className="rounded-md p-1.5 bg-foreground/10 text-foreground/60">
                <Circle className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground/60">
              {stats.totalLabels - stats.coveredLabels}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Events</span>
              <div className="rounded-md p-1.5 bg-primary/10 text-primary">
                <Hash className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums">{stats.totalEvents}</div>
          </CardContent>
        </Card>
      </div>

      {coverageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Events per risk label
            </CardTitle>
            <CardDescription>Distribution of annotated events across covered labels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coverageData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    cursor={{ fill: "var(--accent)" }}
                  />
                  <Bar dataKey="auto" stackId="a" fill="var(--foreground)" radius={[0, 0, 0, 4]} />
                  <Bar dataKey="human" stackId="a" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-foreground" /> auto-accepted
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-foreground/50" /> human-routed
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search risk labels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "covered", "uncovered"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                  className="capitalize"
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((label) => (
          <LabelCard key={label.name} label={label} onClick={() => setSelected(label)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No labels match the current filters.
          </CardContent>
        </Card>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <Card className="max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  {selected.name}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)} className="h-7 w-7 p-0">
                  ×
                </Button>
              </div>
              <CardDescription>
                {selected.count} event{selected.count !== 1 ? "s" : ""} · {selected.autoCount} auto · {selected.humanCount}{" "}
                human
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.count === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No events annotated with this label yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Avg confidence</div>
                      <div className="text-lg font-bold tabular-nums text-primary">{selected.avgConfidence.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Auto-accept rate</div>
                      <div
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          selected.autoRate >= 0.5 ? "text-foreground" : "text-foreground/60"
                        )}
                      >
                        {Math.round(selected.autoRate * 100)}%
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Recommended actions</div>
                    <div className="space-y-1.5">
                      {Object.entries(selected.actions).map(([d, count]) => {
                        const pct = selected.count > 0 ? (count / selected.count) * 100 : 0;
                        return (
                          <div key={d} className="flex items-center gap-2">
                            <span className="text-xs w-28 font-mono truncate">{d}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selected.topFactors.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Top risk factors</div>
                      <div className="space-y-1">
                        {selected.topFactors.map((c) => (
                          <div key={c.factor} className="flex items-center justify-between text-xs">
                            <span className="font-mono">{c.factor}</span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {c.count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function LabelCard({ label, onClick }: { label: LabelStat; onClick: () => void }) {
  const covered = label.count > 0;
  return (
    <Card
      className={cn(
        "border cursor-pointer card-hover transition-all",
        covered ? "border-border/60 hover:border-primary/40" : "border-dashed border-border/40 opacity-60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {covered ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium truncate font-mono">{label.name}</span>
            </div>
            {covered ? (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="font-mono">{label.count} ev</span>
                <span className="text-foreground">{label.autoCount} auto</span>
                <span className="text-foreground/60">{label.humanCount} human</span>
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">No events yet</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        {covered && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${label.autoRate * 100}%` }} />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">{Math.round(label.autoRate * 100)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
