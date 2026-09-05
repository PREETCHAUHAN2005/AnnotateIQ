"use client";

import type { Job } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PipelineHealth } from "@/components/pipeline-health";
import { RecentActivityWidget } from "@/components/recent-activity-widget";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  Atom,
  GitBranch,
  Gauge,
  ListChecks,
  ArrowRight,
  ShieldCheck,
  Layers,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function OverviewView({
  jobs,
  onGoToJobs,
  onSelectJob,
}: {
  jobs: Job[];
  onGoToJobs: () => void;
  onSelectJob: (id: string) => void;
}) {
  const totalUnits = jobs.reduce((a, j) => a + j.unitCount, 0);
  const totalAuto = jobs.reduce((a, j) => a + j.autoCount, 0);
  const totalHuman = jobs.reduce((a, j) => a + j.humanCount, 0);
  const totalReviewed = jobs.reduce((a, j) => a + j.reviewedCount, 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="relative overflow-hidden border-primary/20 animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse" />
        <CardContent className="relative p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-start gap-6">
            <div className="flex-1">
              <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 text-primary">
                <Atom className="h-3 w-3" /> Payment risk · Multi-agent
              </Badge>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Annotate payment risk at <span className="text-gradient-emerald">inspectable grade</span>
              </h1>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                A multi-agent system that annotates payment events so teams can train better fraud and
                decision models. Four specialists score transaction, behavior, device, and merchant
                signals. Fraud reasoning proposes a label; an adjudicator marks AGREED or DISPUTED.
                Low-confidence or disputed events go to humans. Synthetic or public-shaped data only —
                not Razorpay production transactions.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={onGoToJobs} className="gap-2">
                  <ListChecks className="h-4 w-4" /> Create a job
                </Button>
                <Button variant="outline" onClick={onGoToJobs} className="gap-2">
                  <ArrowRight className="h-4 w-4" /> Browse jobs
                </Button>
              </div>
              {/* Feature pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["k=3 fraud reasoning", "adjudicator-gated", "honeypot-verified", "weakest-link scoring"].map((pill) => (
                  <span key={pill} className="text-[10px] font-mono px-2 py-1 rounded-full bg-primary/5 border border-primary/20 text-primary/80">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Pipeline mini-diagram */}
            <div className="w-full lg:w-80 shrink-0">
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Pipeline
                </div>
                {[
                  { label: "Normalize payment event", icon: Layers, tone: "text-muted-foreground" },
                  { label: "4 specialists in parallel", icon: Cpu, tone: "text-primary" },
                  { label: "Fraud reasoning · k=3", icon: GitBranch, tone: "text-foreground/80" },
                  { label: "Adjudicator · AGREED/DISPUTED", icon: ShieldCheck, tone: "text-foreground/60" },
                  { label: "Confidence ≥ 0.85 → auto", icon: Gauge, tone: "text-foreground" },
                ].map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <div className="flex flex-col items-center">
                        <Icon className={cn("h-4 w-4", step.tone)} />
                        {i < 4 && <div className="w-px h-4 bg-border" />}
                      </div>
                      <span className="text-foreground/90">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline health widget */}
      <PipelineHealth />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Jobs" value={jobs.length} icon={ListChecks} tone="primary" />
        <StatCard label="Units" value={totalUnits} icon={Layers} tone="teal" />
        <StatCard label="Auto-accepted" value={totalAuto} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Human-routed" value={totalHuman} icon={GitBranch} tone="amber" />
        <StatCard label="Reviewed" value={totalReviewed} icon={CheckCircle2} tone="violet" />
      </div>

      {/* Recent jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent jobs</CardTitle>
          <CardDescription>Jump back into a pipeline or review session.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No jobs yet. Create one to get started.</p>
              <Button variant="outline" onClick={onGoToJobs} className="mt-3 gap-2">
                Create job <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 6).map((j) => (
                <button
                  key={j.id}
                  onClick={() => onSelectJob(j.id)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-accent/40 transition text-left group"
                >
                  <StatusPill status={j.status} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{j.filename}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {j.unitCount} units · {j.autoCount} auto · {j.humanCount} human · {j.reviewedCount} reviewed
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity widget */}
      <RecentActivityWidget />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "teal" | "emerald" | "amber" | "violet";
}) {
  // Use foreground (adapts to theme) with slight opacity variations
  const toneClass = {
    primary: "text-foreground",
    teal: "text-foreground/80",
    emerald: "text-foreground/90",
    amber: "text-foreground/60",
    violet: "text-foreground/70",
  }[tone];
  return (
    <Card className="border-border/60 card-hover animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className={cn("rounded-md p-1 bg-current/10", toneClass)}>
            <Icon className={cn("h-3.5 w-3.5", toneClass)} />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">
          <AnimatedCounter value={value} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "pending", cls: "bg-muted text-muted-foreground" },
    extracting: { label: "extracting", cls: "bg-primary/15 text-primary" },
    labeling: { label: "labeling", cls: "bg-primary/15 text-primary" },
    review: { label: "review", cls: "bg-foreground/15 text-foreground/60" },
    done: { label: "done", cls: "bg-foreground/15 text-foreground" },
    failed: { label: "failed", cls: "bg-rose-500/15 text-rose-400" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("text-[10px] font-mono px-2 py-1 rounded-md shrink-0", s.cls)}>{s.label}</span>;
}
