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

const PIE_COLORS = ["var(--foreground)", "var(--muted-foreground)", "var(--muted-foreground)", "var(--muted-foreground)", "var(--muted-foreground)", "#f87171"];
const LANG_COLORS = ["var(--foreground)", "var(--muted-foreground)", "var(--muted-foreground)"];

export function QualityView({ job }: { job: Job }) {
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const s = await api.getQuality(job.id);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quality stats");
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
  if (error && !stats) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <p className="text-rose-400 text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
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

  const riskData = Object.entries(stats.distributions.risk_label ?? {}).map(([name, value]) => ({ name, value }));
  const actionData = Object.entries(stats.distributions.recommended_action ?? {})
    .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 20) + "…" : name, fullName: name, value }))
    .sort((a, b) => b.value - a.value);
  const chargebackData = Object.entries(stats.distributions.chargeback_risk ?? {}).map(([name, value]) => ({ name, value }));
  const consensusData = Object.entries(stats.distributions.consensus ?? {}).map(([name, value]) => ({ name, value }));
  const avgConfData = (stats.avgConfByLabel ?? []).map((d) => ({ label: d.label, avg: d.avg, count: d.count }));
  const hpAgents = Object.values(stats.honeypot.perAgent);
  const hpAcc = hpAgents.length ? hpAgents.reduce((a, s) => a + s.accuracy, 0) / hpAgents.length : null;

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
          sub={`${stats.totals.auto} of ${stats.totals.finals} events`}
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
            hpAcc != null ? `${(hpAcc * 100).toFixed(0)}%` : "—"
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

      {stats.heldOut && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Held-out precision, recall, and FP cost
            </CardTitle>
            <CardDescription>
              Razorpay AI Risk Manager bar. Gold is frozen honeypots / IEEE-CIS <code>isFraud</code> —
              specialists never see it. Agreement and honeypot accuracy are separate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Precision</div>
                <div className="text-2xl font-bold tabular-nums">
                  {stats.heldOut.n ? `${(stats.heldOut.risk.precision * 100).toFixed(1)}%` : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  TP {stats.heldOut.risk.tp} / (TP+FP {stats.heldOut.risk.tp + stats.heldOut.risk.fp})
                </div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recall</div>
                <div className="text-2xl font-bold tabular-nums">
                  {stats.heldOut.n ? `${(stats.heldOut.risk.recall * 100).toFixed(1)}%` : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  TP {stats.heldOut.risk.tp} / (TP+FN {stats.heldOut.risk.tp + stats.heldOut.risk.fn})
                </div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">FP cost</div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatInr(stats.heldOut.falsePositiveCost.total)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {stats.heldOut.falsePositiveCost.falsePositives} false positives · INR
                </div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Held-out n</div>
                <div className="text-2xl font-bold tabular-nums">{stats.heldOut.n}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  F1 {(stats.heldOut.risk.f1 * 100).toFixed(1)}% · FN cost {formatInr(stats.heldOut.falseNegativeCost.missedFraudGmv)}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-4 gap-2 text-xs font-mono">
              <span>TP {stats.heldOut.risk.tp}</span>
              <span className="text-rose-400">FP {stats.heldOut.risk.fp}</span>
              <span className="text-rose-400">FN {stats.heldOut.risk.fn}</span>
              <span>TN {stats.heldOut.risk.tn}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{stats.heldOut.falsePositiveCost.notes}</p>
          </CardContent>
        </Card>
      )}

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
            <KappaBar label="Risk label" kappa={stats.kappa.risk_label} />
            <KappaBar label="Recommended action" kappa={stats.kappa.recommended_action} />
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
              <span className="flex items-center gap-1.5 text-foreground">
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
            <CardTitle className="text-base">Risk label distribution</CardTitle>
            <CardDescription>Across all finalized events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {riskData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended action</CardTitle>
            <CardDescription>ALLOW / REVIEW / STEP_UP / HOLD / REJECT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    cursor={{ fill: "var(--accent)" }}
                  />
                  <Bar dataKey="value" fill="var(--foreground)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Chargeback risk
            </CardTitle>
            <CardDescription>LOW / MEDIUM / HIGH across events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chargebackData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="oklch(1 0 0 / 10%)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} angle={90} />
                  <Radar dataKey="value" stroke="var(--foreground)" fill="var(--foreground)" fillOpacity={0.4} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" /> Consensus
            </CardTitle>
            <CardDescription>AGREED vs DISPUTED</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={consensusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {consensusData.map((_, i) => (
                      <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {avgConfData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Confidence by risk label
            </CardTitle>
            <CardDescription>Average confidence score per risk label (sorted high → low)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgConfData} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis type="number" domain={[0, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    cursor={{ fill: "var(--accent)" }}
                    formatter={(v: number) => [v.toFixed(3), "avg confidence"]}
                  />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {avgConfData.map((d, i) => (
                      <Cell key={i} fill={d.avg >= 0.85 ? "var(--foreground)" : d.avg >= 0.6 ? "var(--muted-foreground)" : "#f87171"} />
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
                  <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    cursor={{ fill: "var(--accent)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(stats.confidenceBuckets ?? []).map((_, i) => (
                      <Cell key={i} fill={["#f87171", "var(--muted-foreground)", "var(--muted-foreground)", "var(--muted-foreground)", "var(--foreground)"][i % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> low</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-foreground/50" /> medium</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-foreground" /> high (auto)</span>
              <span className="ml-auto">threshold ≥ 0.85</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event tally */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-foreground/60" /> Quality events
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
    emerald: "text-foreground bg-foreground/10",
    teal: "text-foreground/80 bg-foreground/10",
    amber: "text-foreground/60 bg-foreground/10",
    violet: "text-foreground/70 bg-foreground/10",
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
    kappa.tone === "good" ? "bg-foreground" : kappa.tone === "warn" ? "bg-foreground/50" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              kappa.tone === "good" && "border-foreground/30 text-foreground",
              kappa.tone === "warn" && "border-foreground/20 text-foreground/60",
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
      <div className="text-[10px] text-muted-foreground mt-1">{kappa.n} events rated by fraud reasoning k=3</div>
    </div>
  );
}

function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
