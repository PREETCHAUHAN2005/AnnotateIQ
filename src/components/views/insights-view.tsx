"use client";

import { useEffect, useState } from "react";
import type { InsightsStats } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Loader2,
  Sparkles,
  Clock,
  ShieldCheck,
  Target,
  Zap,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_COLORS = ["var(--foreground)", "var(--muted-foreground)", "#f87171"];
const ACTION_COLORS = ["var(--foreground)", "var(--muted-foreground)", "var(--muted-foreground)", "var(--muted-foreground)"];
const CONSENSUS_COLORS = ["var(--foreground)", "var(--muted-foreground)", "var(--muted-foreground)"];

export function InsightsView() {
  const [stats, setStats] = useState<InsightsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getInsights()
      .then((r) => {
        if (!cancelled) {
          setStats(r);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load insights");
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

  if (error) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-2">
          <p className="text-rose-400 text-sm">{error}</p>
          <p className="text-muted-foreground text-xs">Could not load insights. Try refreshing.</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.trends.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          No insights data yet. Run the pipeline on at least one job.
        </CardContent>
      </Card>
    );
  }

  const { summary, trends, distributions } = stats;

  // trend data for charts
  const trendData = trends.map((t) => ({
    name: t.filename.replace(/\.(json|pdf)$/i, "").replace(/_/g, " ").trim().slice(0, 18),
    autoRate: Math.round(t.autoRate * 100),
    avgConf: Number(t.avgConfidence.toFixed(2)),
    kappa: Number(t.kappa.toFixed(3)),
    honeypotAcc: Math.round(t.honeypotAccuracy * 100),
  }));

  const cumulativeData = trends.map((t) => ({
    name: t.filename.replace(/\.(json|pdf)$/i, "").replace(/_/g, " ").trim().slice(0, 18),
    units: t.cumulativeUnits,
    auto: t.cumulativeAuto,
    human: t.cumulativeHuman,
    hours: Number(t.cumulativeHours.toFixed(1)),
  }));

  const riskData = Object.entries(distributions.risk_label ?? {}).map(([name, value]) => ({ name, value }));
  const actionData = Object.entries(distributions.recommended_action ?? {}).map(([name, value]) => ({ name, value }));
  const consensusData = Object.entries(distributions.consensus ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> Insights & Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cross-job trends and aggregated metrics across {summary.totalJobs} jobs.
        </p>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Overall auto-rate"
          value={`${Math.round(summary.overallAutoRate * 100)}%`}
          sub={`${summary.totalAuto} of ${summary.totalUnits} units`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <KpiCard
          label="Avg confidence"
          value={summary.overallAvgConf.toFixed(2)}
          sub="across all finals"
          icon={Target}
          tone="teal"
        />
        <KpiCard
          label="Hours saved"
          value={summary.totalHoursSaved.toFixed(1)}
          sub="vs 4 min/event manual"
          icon={Clock}
          tone="amber"
        />
        <KpiCard
          label="Total units"
          value={summary.totalUnits}
          sub={`${summary.totalJobs} jobs`}
          icon={Zap}
          tone="violet"
        />
      </div>

      {stats.heldOut && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Held-out precision"
            value={stats.heldOut.n ? `${(stats.heldOut.risk.precision * 100).toFixed(1)}%` : "—"}
            sub={`n=${stats.heldOut.n} gold units`}
            icon={Target}
            tone="emerald"
          />
          <KpiCard
            label="Held-out recall"
            value={stats.heldOut.n ? `${(stats.heldOut.risk.recall * 100).toFixed(1)}%` : "—"}
            sub={`TP ${stats.heldOut.risk.tp} · FN ${stats.heldOut.risk.fn}`}
            icon={Award}
            tone="teal"
          />
          <KpiCard
            label="FP cost"
            value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(stats.heldOut.falsePositiveCost.total)}
            sub={`${stats.heldOut.falsePositiveCost.falsePositives} false positives`}
            icon={ShieldCheck}
            tone="amber"
          />
          <KpiCard
            label="FN loss (missed)"
            value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(stats.heldOut.falseNegativeCost.missedFraudGmv)}
            sub={`${stats.heldOut.falseNegativeCost.falseNegatives} missed fraud`}
            icon={Clock}
            tone="violet"
          />
        </div>
      )}

      {/* Trend charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Auto-accept rate trend
            </CardTitle>
            <CardDescription>Percentage of units auto-accepted per job</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="%" />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="autoRate" stroke="var(--foreground)" strokeWidth={2} dot={{ fill: "var(--foreground)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Confidence & kappa trend
            </CardTitle>
            <CardDescription>Avg confidence and Fleiss' κ per job</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="avgConf" stroke="var(--foreground)" strokeWidth={2} name="Avg confidence" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="kappa" stroke="var(--muted-foreground)" strokeWidth={2} name="Fleiss κ" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cumulative growth chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Cumulative growth
          </CardTitle>
          <CardDescription>Units processed and hours saved over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
                <defs>
                  <linearGradient id="autoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="humanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--muted-foreground)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--muted-foreground)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="auto" stackId="a" stroke="var(--foreground)" fill="url(#autoGrad)" name="Cumulative auto" />
                <Area type="monotone" dataKey="human" stackId="a" stroke="var(--muted-foreground)" fill="url(#humanGrad)" name="Cumulative human" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribution charts */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk label mix</CardTitle>
            <CardDescription>Across all jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name}: ${e.value}`}>
                    {riskData.map((_, i) => <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended actions</CardTitle>
            <CardDescription>ALLOW / REVIEW / HOLD / REJECT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {actionData.map((_, i) => <Cell key={i} fill={ACTION_COLORS[i % ACTION_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consensus</CardTitle>
            <CardDescription>AGREED / DISPUTED</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={consensusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} label={(e) => `${e.name}: ${e.value}`}>
                    {consensusData.map((_, i) => <Cell key={i} fill={CONSENSUS_COLORS[i % CONSENSUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best performer banner */}
      {trends.length > 0 && (
        <Card className="border-primary/30 glow-emerald">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-3">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Best performing job</div>
              <div className="font-semibold">
                {trends.reduce((best, t) => (t.autoRate > best.autoRate ? t : best)).filename}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary tabular-nums">
                {Math.round(trends.reduce((best, t) => (t.autoRate > best.autoRate ? t : best)).autoRate * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">auto-accept rate</div>
            </div>
          </CardContent>
        </Card>
      )}
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
  value: string | number;
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
    <Card className="border-border/60 card-hover animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className={cn("rounded-md p-1.5", toneCls)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className={cn("text-2xl font-bold tabular-nums", toneCls.split(" ")[0])}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
