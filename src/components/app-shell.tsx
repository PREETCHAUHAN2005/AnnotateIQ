"use client";

import type { Job } from "@/lib/types";
import type { ViewKey } from "@/app/page";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Atom,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Play,
  Download,
  RefreshCw,
  GitBranch,
  Sparkles,
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
  { key: "jobs", label: "Jobs & Upload", icon: ListChecks, shortcut: "j" },
  { key: "pipeline", label: "Live Pipeline", icon: Play, shortcut: "p" },
  { key: "units", label: "Annotated Units", icon: TableProperties, shortcut: "u" },
  { key: "review", label: "Review Queue", icon: GitBranch, shortcut: "r" },
  { key: "honeypot", label: "Honeypot Inspector", icon: FlaskConical, shortcut: "h" },
  { key: "quality", label: "Quality", icon: Gauge, shortcut: "q" },
  { key: "compare", label: "Compare Jobs", icon: GitCompare, shortcut: "c" },
  { key: "insights", label: "Insights", icon: TrendingUp, shortcut: "i" },
  { key: "taxonomy", label: "Taxonomy", icon: BookOpen, shortcut: "t" },
  { key: "search", label: "Global Search", icon: Search, shortcut: "s" },
  { key: "activity", label: "Activity", icon: Activity, shortcut: "y" },
  { key: "architecture", label: "Architecture", icon: Network, shortcut: "a" },
  { key: "export", label: "Export", icon: Download, shortcut: "e" },
];

export function AppShell({
  view,
  onViewChange,
  jobs,
  activeJob,
  onSelectJob,
  onRefreshJobs,
  loadingJobs,
  children,
}: {
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  jobs: Job[];
  activeJob: Job | null;
  onSelectJob: (id: string) => void;
  onRefreshJobs: () => void;
  loadingJobs: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background bg-grid">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
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
                Multi-agent JEE Physics annotation
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

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed md:sticky top-14 z-30 w-64 shrink-0 border-r border-border/60 bg-sidebar/80 backdrop-blur-xl h-[calc(100vh-3.5rem)] transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="flex flex-col h-full">
            <nav className="flex-1 p-3 space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <button
                    key={item.key}
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
                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                    <span className="font-medium">{item.label}</span>
                    {/* Keyboard shortcut hint (show on hover) */}
                    <kbd className={cn(
                      "ml-auto text-[9px] font-mono px-1 py-0.5 rounded transition-opacity",
                      active ? "bg-primary/20 text-primary opacity-100" : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100"
                    )}>
                      g {item.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </nav>

            {/* Jobs list in sidebar */}
            <div className="border-t border-border/60 p-3">
              <div className="flex items-center gap-2 px-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Jobs
                </span>
              </div>
              <ScrollArea className="h-40">
                <div className="space-y-1 pr-2">
                  {jobs.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-3">No jobs yet.</p>
                  )}
                  {jobs.map((j) => {
                    const isActive = activeJob?.id === j.id;
                    return (
                      <button
                        key={j.id}
                        onClick={() => {
                          onSelectJob(j.id);
                          setMobileOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-md text-xs transition group",
                          isActive ? "bg-accent text-foreground" : "hover:bg-accent/60 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <StatusDot status={j.status} />
                          <span className="truncate font-medium">{j.filename}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{j.unitCount} units</span>
                          {j.status === "review" || j.status === "done" ? (
                            <>
                              <span>·</span>
                              <span className="text-primary">{j.autoCount} auto</span>
                              <span>·</span>
                              <span className="text-foreground/60">{j.humanCount} human</span>
                            </>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 top-14 z-20 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-16">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>

      {/* Quiet status bar — metrics live in Architecture / Quality, not here */}
      <footer className="fixed bottom-0 inset-x-0 z-30 border-t border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-10 items-center justify-between gap-4 pl-14 pr-4 sm:px-6 md:pl-6">
          <p className="text-[11px] text-muted-foreground/80 truncate tracking-wide">
            Annotate<span className="text-foreground/70">IQ</span>
            <span className="mx-2 text-border">·</span>
            <span className="hidden sm:inline">Multi-agent JEE Physics annotation</span>
            <span className="sm:hidden">JEE Physics</span>
          </p>
          <p className="shrink-0 text-[10px] font-mono text-muted-foreground/60 tabular-nums hidden sm:block">
            conf ≥ 0.85
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"
      ? "bg-foreground"
      : status === "review"
      ? "bg-foreground/50"
      : status === "labeling" || status === "extracting"
      ? "bg-foreground animate-pulse"
      : status === "failed"
      ? "bg-rose-500"
      : "bg-foreground/25";
  return <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />;
}
