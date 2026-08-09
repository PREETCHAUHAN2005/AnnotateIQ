"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  GitBranch,
  FileText,
  ShieldAlert,
  Filter,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; color: string }> = {
  job_created: { label: "Job created", icon: FileText, tone: "text-primary", color: "bg-primary/10 border-primary/30" },
  honeypot_pass: { label: "Honeypot passed", icon: CheckCircle2, tone: "text-foreground", color: "bg-foreground/5 border-foreground/25" },
  honeypot_fail: { label: "Honeypot failed", icon: XCircle, tone: "text-rose-400", color: "bg-rose-500/5 border-rose-500/30" },
  critic_fail: { label: "Critic failed", icon: ShieldAlert, tone: "text-foreground/60", color: "bg-foreground/5 border-foreground/20" },
  schema_fail: { label: "Schema failed", icon: AlertTriangle, tone: "text-rose-400", color: "bg-rose-500/5 border-rose-500/30" },
  disagreement: { label: "Agent disagreement", icon: GitBranch, tone: "text-foreground/60", color: "bg-foreground/5 border-foreground/20" },
  retry: { label: "Retry triggered", icon: RotateCcw, tone: "text-foreground/70", color: "bg-foreground/5 border-foreground/20" },
};

export function ActivityView() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .getActivity(undefined, kindFilter === "all" ? undefined : kindFilter)
        .then((r) => {
          if (!cancelled) setEvents(r.events);
        })
        .catch((e) => {
          if (!cancelled) toast.error(e instanceof Error ? e.message : "load failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const t = setInterval(load, 8000); // auto-refresh every 8s
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [kindFilter]);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Activity Timeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Chronological log of quality events across all jobs. Auto-refreshes every 8s.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {events.length} event{events.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Button
          size="sm"
          variant={kindFilter === "all" ? "default" : "outline"}
          onClick={() => setKindFilter("all")}
          className="h-7 text-xs"
        >
          All
        </Button>
        {Object.entries(KIND_META).map(([key, meta]) => {
          const count = events.filter((e) => e.kind === key).length;
          return (
            <Button
              key={key}
              size="sm"
              variant={kindFilter === key ? "default" : "outline"}
              onClick={() => setKindFilter(key)}
              className="h-7 text-xs gap-1.5"
            >
              <meta.icon className={cn("h-3 w-3", meta.tone)} />
              {meta.label}
              {kindFilter === "all" || kindFilter === key ? (
                count > 0 && <span className="font-mono text-[10px] opacity-70">{count}</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No activity yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Run a pipeline to generate quality events.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-2">
                {events.map((event, idx) => {
                  const meta = KIND_META[event.kind] ?? KIND_META.disagreement;
                  const Icon = meta.icon;
                  const time = new Date(event.createdAt);
                  const timeStr = time.toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  return (
                    <div key={event.id} className="relative flex gap-3 animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                      {/* Timeline line */}
                      {idx < events.length - 1 && (
                        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border/60" />
                      )}
                      {/* Icon */}
                      <div className={cn("relative z-10 rounded-full border-2 p-1.5 shrink-0", meta.color)}>
                        <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
                      </div>
                      {/* Content */}
                      <div className={cn("flex-1 p-3 rounded-lg border mb-1", meta.color)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("text-sm font-semibold", meta.tone)}>{meta.label}</span>
                              {event.seq != null && (
                                <Badge variant="outline" className="text-[9px] font-mono">#{event.seq}</Badge>
                              )}
                              {event.jobFilename && (
                                <span className="text-[10px] text-muted-foreground truncate">{event.jobFilename}</span>
                              )}
                            </div>
                            {event.stem && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.stem}</p>
                            )}
                            {event.detail && (
                              <pre className="text-[10px] font-mono text-muted-foreground mt-1.5 p-1.5 rounded bg-muted/40 overflow-x-auto max-h-20">
                                {event.detail.length > 200 ? event.detail.slice(0, 200) + "..." : event.detail}
                              </pre>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{timeStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
