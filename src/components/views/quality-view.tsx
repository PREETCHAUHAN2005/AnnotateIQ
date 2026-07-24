"use client";

import { useEffect, useState } from "react";
import type { Job, QualityStats } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Gauge,
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Bot,
  RefreshCw,
  Loader2,
  Brain,
  Languages,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#ffffff", "#cccccc", "#999999", "#666666", "#444444", "#f87171"];
const LANG_COLORS = ["#ffffff", "#888888", "#555555"];

export function QualityView({ job }: { job: Job }) {
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const s = await api.getQuality(job.id);
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!stats) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          No quality data yet. Run the pipeline first.
        </CardContent>
      </Card>
    );
  }

  const diffData = Object.entries(stats.distributions.difficulty).map(([name, value]) => ({ name, value }));
  const chapterData = Object.entries(stats.distributions.chapter)
    .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 20) + "…" : name, fullName: name, value }))
    .sort((a, b) => b.value - a.value);
  const bloomData = Object.entries(stats.distributions.bloom ?? {}).map(([name, value]) => ({ name, value }));
  const langData = Object.entries(stats.distributions.language ?? {}).map(([name, value]) => ({ name, value }));
  const avgConfData = stats.avgConfByChapter ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quality Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every number here is computed from real pipeline output. None hardcoded.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Auto-accept rate"
          value={`${(stats.rates.autoRate * 100).toFixed(0)}%`}
          sub={`${stats.totals.auto} of ${stats.totals.finals} units`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <KpiCard
          label="Hours saved"
          value={stats.rates.hoursSaved.toFixed(1)}
          sub={`vs ${stats.rates.manualMinutes} min manual baseline`}
          icon={Clock}
          tone="teal"
        />
        <KpiCard
          label="Honeypot accuracy"
          value={
            stats.honeypot.perAgent.taxonomy
              ? `${(stats.honeypot.perAgent.taxonomy.accuracy * 100).toFixed(0)}%`
              : "—"
          }
          sub={`${stats.honeypot.pass} pass · ${stats.honeypot.fail} fail`}
          icon={CheckCircle2}
          tone="amber"
        />
        <KpiCard
          label="Reviewed"
          value={`${stats.totals.reviewed}`}
          sub={`of ${stats.totals.human} human-routed`}
          icon={TrendingUp}
          tone="violet"
        />
      </div>

      {/* Fleiss kappa + honeypot trust */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Inter-annotator agreement
            </CardTitle>
            <CardDescription>
              Fleiss&apos; κ across all units — corpus statistic, never used for per-unit routing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KappaBar label="Chapter" kappa={stats.kappa.chapter} />
            <KappaBar label="Difficulty" kappa={stats.kappa.difficulty} />
            <div className="text-xs text-muted-foreground pt-2 border-t border-border/60">
              <span className="font-semibold">Thresholds:</span> κ &gt; 0.8 production-grade · κ &lt; 0.6 guideline ambiguity
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Honeypot trust score
            </CardTitle>
            <CardDescription>Per-agent accuracy against 20 hand-labelled gold units.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.honeypot.perAgent).length === 0 && (
              <p className="text-sm text-muted-foreground">No honeypots evaluated yet.</p>
            )}
            {Object.entries(stats.honeypot.perAgent).map(([agent, s]) => (
              <div key={agent}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="capitalize font-medium">{agent}</span>
                  <span className="font-mono text-muted-foreground">
                    {s.correct}/{s.total} · {(s.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={s.accuracy * 100} className="h-2" />
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> {stats.honeypot.pass} pass
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <XCircle className="h-3.5 w-3.5" /> {stats.honeypot.fail} fail
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Difficulty distribution</CardTitle>
            <CardDescription>Across all finalized units</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diffData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {diffData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chapter distribution</CardTitle>
            <CardDescription>NCERT chapters covered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chapterData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis type="number" tick={{ fill: "#888888", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#888888", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }}
                    cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                  />
                  <Bar dataKey="value" fill="#ffffff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloom radar + Language donut */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Bloom&apos;s taxonomy distribution
            </CardTitle>
            <CardDescription>Cognitive complexity of annotated units</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={bloomData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="oklch(1 0 0 / 10%)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "#888888", fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: "#888888", fontSize: 9 }} angle={90} />
                  <Radar dataKey="value" stroke="#ffffff" fill="#ffffff" fillOpacity={0.4} />
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" /> Language distribution
            </CardTitle>
            <CardDescription>en / hi / hinglish split</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={langData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {langData.map((_, i) => (
                      <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avg confidence by chapter */}
      {avgConfData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Confidence by chapter
            </CardTitle>
            <CardDescription>Average confidence score per chapter (sorted high → low)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgConfData} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis type="number" domain={[0, 1]} tick={{ fill: "#888888", fontSize: 11 }} />
                  <YAxis type="category" dataKey="chapter" width={130} tick={{ fill: "#888888", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }}
                    cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                    formatter={(v: number) => [v.toFixed(3), "avg confidence"]}
                  />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {avgConfData.map((d, i) => (
                      <Cell key={i} fill={d.avg >= 0.85 ? "#ffffff" : d.avg >= 0.6 ? "#888888" : "#f87171"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent latency + confidence distribution */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Agent latency
            </CardTitle>
            <CardDescription>Per-agent response time (ms) — attempt 1 only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.latency && Object.entries(stats.latency).map(([agent, l]) => (
              <div key={agent} className="flex items-center gap-3">
                <div className="w-20 text-xs font-medium capitalize shrink-0">{agent}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>avg <span className="font-mono text-foreground">{l.avg}ms</span></span>
                    <span>·</span>
                    <span>p95 <span className="font-mono text-foreground">{l.p95}ms</span></span>
                    <span>·</span>
                    <span>n={l.count}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute h-full rounded-full bg-primary/30"
                      style={{ width: `${Math.min(100, (l.avg / Math.max(l.max, 1)) * 100)}%` }}
                    />
                    <div
                      className="absolute h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (l.p95 / Math.max(l.max, 1)) * 100)}%`, opacity: 0.6 }}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono w-24 text-right shrink-0">
                  {l.min}–{l.max}ms
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Confidence distribution
            </CardTitle>
            <CardDescription>How units spread across confidence buckets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.confidenceBuckets ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="label" tick={{ fill: "#888888", fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#888888", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }}
                    cursor={{ fill: "oklch(1 0 0 / 5%)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(stats.confidenceBuckets ?? []).map((_, i) => (
                      <Cell key={i} fill={["#f87171", "#666666", "#888888", "#cccccc", "#ffffff"][i % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> low</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-white/50" /> medium</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-white" /> high (auto)</span>
              <span className="ml-auto">threshold ≥ 0.85</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event tally */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-white/60" /> Quality events
          </CardTitle>
          <CardDescription>Raw counts of every quality signal emitted</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(stats.events).length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">No events.</p>
            )}
            {Object.entries(stats.events).map(([kind, count]) => (
              <div key={kind} className="rounded-lg border border-border/60 p-3 text-center">
                <div className="text-2xl font-bold tabular-nums">{count}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{kind}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "teal" | "amber" | "violet";
}) {
  const toneCls = {
    emerald: "text-white bg-white/10",
    teal: "text-white/80 bg-white/10",
    amber: "text-white/60 bg-white/10",
    violet: "text-white/70 bg-white/10",
  }[tone];
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className={cn("rounded-md p-1.5", toneCls)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function KappaBar({
  label,
  kappa,
}: {
  label: string;
  kappa: { value: number; label: string; tone: "good" | "warn" | "bad"; n: number };
}) {
  const pct = Math.max(0, Math.min(100, kappa.value * 100));
  const barColor =
    kappa.tone === "good" ? "bg-white" : kappa.tone === "warn" ? "bg-white/50" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              kappa.tone === "good" && "border-white/30 text-white",
              kappa.tone === "warn" && "border-white/20 text-white/60",
              kappa.tone === "bad" && "border-rose-500/40 text-rose-400"
            )}
          >
            {kappa.label}
          </Badge>
          <span className="font-mono text-sm tabular-nums">κ = {kappa.value.toFixed(3)}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{kappa.n} units rated by k=3</div>
    </div>
  );
}
