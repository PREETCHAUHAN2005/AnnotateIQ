"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  Database,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HealthStatus = {
  status: "healthy" | "degraded" | "down";
  jobs: number;
  activeJobs: number;
  totalUnits: number;
  pendingUnits: number;
  labeledUnits: number;
  reviewedUnits: number;
  agentsAvailable: number;
  dbConnected: boolean;
};

export function PipelineHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/health");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setHealth(data);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!health) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" /> Checking system health...
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    healthy: { label: "All systems operational", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2, dot: "bg-emerald-500" },
    degraded: { label: "Some units need attention", color: "text-amber-400", bg: "bg-amber-400/10", icon: AlertTriangle, dot: "bg-amber-400" },
    down: { label: "System unavailable", color: "text-rose-400", bg: "bg-rose-500/10", icon: XCircle, dot: "bg-rose-500" },
  }[health.status];

  const StatusIcon = statusConfig.icon;

  return (
    <Card className="border-border/60 card-hover">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-md p-1.5", statusConfig.bg)}>
              <StatusIcon className={cn("h-3.5 w-3.5", statusConfig.color)} />
            </div>
            <span className="text-sm font-medium">Pipeline Health</span>
          </div>
          <Badge variant="outline" className={cn("gap-1.5 text-[10px]", statusConfig.color)}>
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", statusConfig.dot)} />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-2">
          <HealthMetric
            icon={Cpu}
            label="Agents"
            value={health.agentsAvailable}
            sub="available"
            tone="text-primary"
          />
          <HealthMetric
            icon={Database}
            label="DB"
            value={health.dbConnected ? "UP" : "DOWN"}
            sub={health.dbConnected ? "connected" : "offline"}
            tone={health.dbConnected ? "text-emerald-400" : "text-rose-400"}
          />
          <HealthMetric
            icon={Zap}
            label="Labeled"
            value={health.labeledUnits}
            sub={`of ${health.totalUnits}`}
            tone="text-teal-400"
          />
          <HealthMetric
            icon={Activity}
            label="Pending"
            value={health.pendingUnits}
            sub="in queue"
            tone={health.pendingUnits > 0 ? "text-amber-400" : "text-muted-foreground"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HealthMetric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
  tone: string;
}) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
      <Icon className={cn("h-3.5 w-3.5 mx-auto mb-1", tone)} />
      <div className={cn("text-sm font-bold tabular-nums", tone)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-[8px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
