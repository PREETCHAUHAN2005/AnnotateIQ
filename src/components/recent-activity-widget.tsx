"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  GitBranch,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  job_created: { icon: FileText, tone: "text-primary" },
  honeypot_pass: { icon: CheckCircle2, tone: "text-white" },
  honeypot_fail: { icon: XCircle, tone: "text-rose-400" },
  critic_fail: { icon: ShieldAlert, tone: "text-white/60" },
  schema_fail: { icon: AlertTriangle, tone: "text-rose-400" },
  disagreement: { icon: GitBranch, tone: "text-white/60" },
  retry: { icon: RotateCcw, tone: "text-white/70" },
};

export function RecentActivityWidget() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .getActivity(undefined, undefined)
        .then((r) => {
          if (!cancelled) setEvents(r.events.slice(0, 8));
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-primary" /> Recent Activity
        </CardTitle>
        <CardDescription>Latest events across all jobs</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No recent activity.</div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-1 p-3 pt-0">
              {events.map((event) => {
                const meta = KIND_ICON[event.kind] ?? KIND_ICON.disagreement;
                const Icon = meta.icon;
                const time = new Date(event.createdAt);
                const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/30 transition"
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.tone)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {event.kind.replace(/_/g, " ")}
                        {event.seq != null && (
                          <span className="text-muted-foreground font-mono ml-1">#{event.seq}</span>
                        )}
                      </div>
                      {event.jobFilename && (
                        <div className="text-[10px] text-muted-foreground truncate">{event.jobFilename}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">{timeStr}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
