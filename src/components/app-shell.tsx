"use client";

import type { Job } from "@/lib/types";
import type { ViewKey } from "@/app/page";
import { Badge } from "@/components/ui/badge";
import {
  Atom,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Play,
  Download,
  RefreshCw,
  GitBranch,
  TableProperties,
  GitCompare,
  FlaskConical,
  Network,
  BookOpen,
  Activity,
  Search,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; shortcut: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, shortcut: "o" },
  { key: "jobs", label: "Jobs & ingest", icon: ListChecks, shortcut: "j" },
  { key: "pipeline", label: "Live Pipeline", icon: Play, shortcut: "p" },
  { key: "units", label: "Annotated Events", icon: TableProperties, shortcut: "u" },
  { key: "review", label: "Review Queue", icon: GitBranch, shortcut: "r" },
  { key: "honeypot", label: "Honeypot Inspector", icon: FlaskConical, shortcut: "h" },
  { key: "quality", label: "Quality", icon: Gauge, shortcut: "q" },
  { key: "compare", label: "Compare Jobs", icon: GitCompare, shortcut: "c" },
  { key: "insights", label: "Insights", icon: TrendingUp, shortcut: "i" },
  { key: "taxonomy", label: "Risk taxonomy", icon: BookOpen, shortcut: "t" },
  { key: "search", label: "Global Search", icon: Search, shortcut: "s" },
  { key: "activity", label: "Activity", icon: Activity, shortcut: "y" },
  { key: "architecture", label: "Architecture", icon: Network, shortcut: "a" },
  { key: "export", label: "Export", icon: Download, shortcut: "e" },
];

export function AppShell({
  view,
  onViewChange,
  activeJob,
  onRefreshJobs,
  loadingJobs,
  children,
}: {
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  activeJob: Job | null;
  onRefreshJobs: () => void;
  loadingJobs: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background bg-grid">
      {/* Top bar */}
      <header className="shrink-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            type="button"
            className="md:hidden p-2 -ml-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle nav"
          >
            <Atom className="h-5 w-5 text-primary" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-md rounded-full" />
              <Atom className="relative h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight text-sm">
                Annotate<span className="text-gradient-emerald">IQ</span>
              </span>
              <span className="text-[10px] text-muted-foreground -mt-0.5 hidden sm:block">
                Payment risk annotation engine
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {activeJob && (
              <Badge variant="outline" className="hidden sm:inline-flex gap-1.5 font-mono text-xs max-w-[200px]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="truncate">
                  {activeJob.filename.slice(0, 22)}
                  {activeJob.filename.length > 22 ? "…" : ""}
                </span>
              </Badge>
            )}
            <button
              type="button"
              onClick={onRefreshJobs}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loadingJobs && "animate-spin")} />
            </button>
            <kbd
              className="hidden md:inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border/70 bg-muted/50 text-[10px] font-mono text-muted-foreground"
              title="Open command palette"
            >
              ⌘K
            </kbd>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar — own scroll, does not drive main content */}
        <aside
          className={cn(
            "fixed md:sticky md:top-0 z-30 w-64 shrink-0 border-r border-border/60 bg-sidebar/95 backdrop-blur-xl",
            "h-[calc(100vh-3.5rem)] md:h-full transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <nav
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-0.5"
              aria-label="Primary"
              onWheel={(e) => e.stopPropagation()}
            >
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onViewChange(item.key);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                      active
                        ? "bg-primary/15 text-primary glow-emerald"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                    <span className="font-medium truncate">{item.label}</span>
                    <kbd
                      className={cn(
                        "ml-auto text-[9px] font-mono px-1 py-0.5 rounded transition-opacity shrink-0",
                        active
                          ? "bg-primary/20 text-primary opacity-100"
                          : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100"
                      )}
                    >
                      g {item.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 top-14 z-20 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Main content — independent scroll */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
