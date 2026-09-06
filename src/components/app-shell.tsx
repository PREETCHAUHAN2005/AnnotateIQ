"use client";

import type { Job } from "@/lib/types";
import type { ViewKey } from "@/app/page";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import {
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
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Work",
    items: [
      { key: "overview", label: "Overview", icon: LayoutDashboard, shortcut: "o" },
      { key: "jobs", label: "Jobs & ingest", icon: ListChecks, shortcut: "j" },
      { key: "pipeline", label: "Live Pipeline", icon: Play, shortcut: "p" },
      { key: "units", label: "Annotated Events", icon: TableProperties, shortcut: "u" },
      { key: "review", label: "Review Queue", icon: GitBranch, shortcut: "r" },
    ],
  },
  {
    title: "Inspect",
    items: [
      { key: "honeypot", label: "Honeypot Inspector", icon: FlaskConical, shortcut: "h" },
      { key: "quality", label: "Quality", icon: Gauge, shortcut: "q" },
      { key: "compare", label: "Compare Jobs", icon: GitCompare, shortcut: "c" },
      { key: "insights", label: "Insights", icon: TrendingUp, shortcut: "i" },
    ],
  },
  {
    title: "System",
    items: [
      { key: "taxonomy", label: "Risk taxonomy", icon: BookOpen, shortcut: "t" },
      { key: "search", label: "Global Search", icon: Search, shortcut: "s" },
      { key: "activity", label: "Activity", icon: Activity, shortcut: "y" },
      { key: "architecture", label: "Architecture", icon: Network, shortcut: "a" },
      { key: "export", label: "Export", icon: Download, shortcut: "e" },
    ],
  },
];

export function AppShell({
  view,
  onViewChange,
  activeJob,
  onRefreshJobs,
  loadingJobs,
  onOpenPalette,
  children,
}: {
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  activeJob: Job | null;
  onRefreshJobs: () => void;
  loadingJobs: boolean;
  onOpenPalette: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background bg-grid">
      <header className="shrink-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2 sm:gap-3 px-3 sm:px-4 min-w-0">
          <button
            type="button"
            className="md:hidden p-2 -ml-1 rounded-md hover:bg-accent shrink-0"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle nav"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark className="relative h-6 w-6" />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-semibold tracking-tight text-sm truncate">
                Annotate<span className="text-gradient-emerald">IQ</span>
              </span>
              <span className="text-[10px] text-muted-foreground -mt-0.5 hidden sm:block truncate">
                Payment risk annotation engine
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5 min-w-0 shrink-0">
            {activeJob && (
              <Badge variant="outline" className="hidden sm:inline-flex gap-1.5 font-mono text-xs max-w-[140px] lg:max-w-[200px]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="truncate">{activeJob.filename}</span>
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
            <button
              type="button"
              onClick={onOpenPalette}
              className="inline-flex items-center gap-2 h-8 px-2 sm:px-2.5 rounded-md border border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Open command palette"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline text-xs">Search…</span>
              <kbd className="hidden lg:inline-flex items-center h-5 px-1.5 rounded border border-border/70 bg-background text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside
          className={cn(
            "fixed md:sticky md:top-0 z-30 w-64 shrink-0 border-r border-border/60 bg-sidebar/95 backdrop-blur-xl",
            "h-[calc(100vh-3.5rem)] md:h-full transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <nav
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3"
              aria-label="Primary"
              onWheel={(e) => e.stopPropagation()}
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="mb-3">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
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
                            "relative w-full flex items-center gap-3 px-3 py-2 pr-10 rounded-lg text-sm transition-all group min-w-0",
                            active
                              ? "bg-primary/15 text-primary glow-emerald"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                          )}
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                          <span className="font-medium truncate min-w-0 text-left">{item.label}</span>
                          <kbd
                            className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 py-0.5 rounded pointer-events-none",
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
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 top-14 z-20 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
