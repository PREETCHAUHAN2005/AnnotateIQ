"use client";

import { useEffect, useState } from "react";
import type { JobComparison } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { GitCompare, Loader2, Trophy, TrendingUp, ShieldCheck, Target, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const BAR_COLORS = ["var(--foreground)", "var(--muted-foreground)", "var(--muted-foreground)", "var(--muted-foreground)"];

export function CompareView() {
  const [jobs, setJobs] = useState<JobComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .compareJobs()
      .then((r) => {
        if (!cancelled) {
          setJobs(r.jobs);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load comparison");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
          <p className="text-muted-foreground text-xs">Could not load job comparison. Try refreshing.</p>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          No jobs to compare yet. Run the pipeline on at least one job.
        </CardContent>
      </Card>
    );
  }

  const shortName = (f: string) =>
    f
      .replace(/\.(json|pdf)$/i, "")
      .replace(/_/g, " ")
      .trim()
      .slice(0, 22);

  // best job by autoRate
  const best = jobs.reduce((a, b) => (b.autoRate > a.autoRate ? b : a));

  const autoRateData = jobs.map((j) => ({ name: shortName(j.filename), "Auto %": Math.round(j.autoRate * 100), "Human %": Math.round((1 - j.autoRate) * 100) }));
  const confData = jobs.map((j) => ({ name: shortName(j.filename), "Avg Confidence": Number(j.avgConfidence.toFixed(2)) }));
  const kappaData = jobs.map((j) => ({ name: shortName(j.filename), "Fleiss κ": Number(j.kappaRisk.value.toFixed(3)) }));
  const honeypotData = jobs.map((j) => ({ name: shortName(j.filename), Pass: j.honeypotPass, Fail: j.honeypotFail }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GitCompare className="h-6 w-6 text-primary" /> Job Comparison
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare pipeline performance metrics across all {jobs.length} jobs side by side.
        </p>
      </div>

      {/* Best job banner */}
      <Card className="border-primary/30 glow-emerald">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-primary/15 p-3">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Best auto-accept rate</div>
            <div className="font-semibold">{best.filename}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary tabular-nums">{Math.round(best.autoRate * 100)}%</div>
            <div className="text-xs text-muted-foreground">{best.auto} of {best.finals} units</div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Side-by-side metrics</CardTitle>
          <CardDescription>Key metrics for every job</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-3 font-medium">Job</th>
                  <th className="text-right p-3 font-medium">Units</th>
                  <th className="text-right p-3 font-medium">Auto</th>
                  <th className="text-right p-3 font-medium">Human</th>
                  <th className="text-right p-3 font-medium">Auto %</th>
                  <th className="text-right p-3 font-medium">Avg Conf</th>
                  <th className="text-right p-3 font-medium">κ Risk</th>
                  <th className="text-right p-3 font-medium">Honeypot</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border/40 hover:bg-accent/30 transition">
                    <td className="p-3">
                      <div className="font-medium truncate max-w-[200px]">{j.filename}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{j.status}</div>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{j.unitCount}</td>
                    <td className="p-3 text-right font-mono text-foreground tabular-nums">{j.auto}</td>
                    <td className="p-3 text-right font-mono text-foreground/60 tabular-nums">{j.human}</td>
                    <td className="p-3 text-right">
                      <span className={cn("font-mono tabular-nums", j.autoRate >= 0.5 ? "text-foreground" : "text-foreground/60")}>
                        {Math.round(j.autoRate * 100)}%
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{j.avgConfidence.toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <span className={cn("font-mono tabular-nums", j.kappaRisk.tone === "good" && "text-foreground", j.kappaRisk.tone === "warn" && "text-foreground/60", j.kappaRisk.tone === "bad" && "text-rose-400")}>
                        {j.kappaRisk.value.toFixed(3)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs">
                        <span className="text-foreground font-mono">{j.honeypotPass}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-rose-400 font-mono">{j.honeypotFail}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Charts grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Auto vs Human rate" desc="Routing split per job" icon={GitBranch}>
          <BarChart data={autoRateData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="%" />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Auto %" stackId="a" fill="var(--foreground)" radius={[0, 0, 0, 4]} />
            <Bar dataKey="Human %" stackId="a" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Average confidence" desc="Mean confidence per job" icon={Target}>
          <BarChart data={confData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
            <YAxis domain={[0, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
            <Bar dataKey="Avg Confidence" radius={[4, 4, 0, 0]}>
              {confData.map((d, i) => (
                <Cell key={i} fill={d["Avg Confidence"] >= 0.85 ? "var(--foreground)" : d["Avg Confidence"] >= 0.6 ? "var(--muted-foreground)" : "#f87171"} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Inter-annotator agreement" desc="Fleiss' κ per job" icon={TrendingUp}>
          <BarChart data={kappaData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
            <YAxis domain={[0, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
            <Bar dataKey="Fleiss κ" radius={[4, 4, 0, 0]}>
              {kappaData.map((d, i) => (
                <Cell key={i} fill={d["Fleiss κ"] > 0.8 ? "var(--foreground)" : d["Fleiss κ"] >= 0.6 ? "var(--muted-foreground)" : "#f87171"} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Honeypot results" desc="Pass vs fail per job" icon={ShieldCheck}>
          <BarChart data={honeypotData} margin={{ top: 8, right: 8, bottom: 24, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Pass" stackId="a" fill="var(--foreground)" radius={[0, 0, 0, 4]} />
            <Bar dataKey="Fail" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, desc, icon: Icon, children }: { title: string; desc: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
