"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ListChecks,
  Play,
  TableProperties,
  GitBranch,
  FlaskConical,
  Gauge,
  GitCompare,
  Network,
  Download,
  Search,
  Keyboard,
  BookOpen,
  Activity,
} from "lucide-react";
import type { ViewKey } from "@/app/page";
import { cn } from "@/lib/utils";

const SHORTCUTS: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; shortcut: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, shortcut: "g o" },
  { key: "jobs", label: "Jobs & Upload", icon: ListChecks, shortcut: "g j" },
  { key: "pipeline", label: "Live Pipeline", icon: Play, shortcut: "g p" },
  { key: "units", label: "Annotated Units", icon: TableProperties, shortcut: "g u" },
  { key: "review", label: "Review Queue", icon: GitBranch, shortcut: "g r" },
  { key: "honeypot", label: "Honeypot Inspector", icon: FlaskConical, shortcut: "g h" },
  { key: "quality", label: "Quality Dashboard", icon: Gauge, shortcut: "g q" },
  { key: "compare", label: "Compare Jobs", icon: GitCompare, shortcut: "g c" },
  { key: "taxonomy", label: "Taxonomy Browser", icon: BookOpen, shortcut: "g t" },
  { key: "search", label: "Global Search", icon: Search, shortcut: "g s" },
  { key: "activity", label: "Activity Timeline", icon: Activity, shortcut: "g y" },
  { key: "architecture", label: "Architecture", icon: Network, shortcut: "g a" },
  { key: "export", label: "Export", icon: Download, shortcut: "g e" },
];

export function CommandPalette({
  open,
  onOpenChange,
  onViewChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewChange: (v: ViewKey) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = SHORTCUTS.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase())
  );

  const select = useCallback(
    (idx: number) => {
      if (filtered[idx]) {
        onViewChange(filtered[idx].key);
        onOpenChange(false);
        setQuery("");
        setSelectedIndex(0);
      }
    },
    [filtered, onViewChange, onOpenChange]
  );

  useEffect(() => {
    if (!open && (query !== "" || selectedIndex !== 0)) {
      setQuery("");
      setSelectedIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          select(selectedIndex);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered.length, selectedIndex, select, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to view..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No matches</div>
          ) : (
            filtered.map((s, i) => {
              const Icon = s.icon;
              const active = i === selectedIndex;
              return (
                <button
                  key={s.key}
                  onClick={() => select(i)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition",
                    active ? "bg-primary/10 text-primary" : "hover:bg-accent/40"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium flex-1">{s.label}</span>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {s.shortcut}
                  </kbd>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Keyboard className="h-3 w-3" /> ↑↓ navigate · ↵ select
          </span>
          <span>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Global</div>
            {[
              { keys: ["⌘", "K"], action: "Open command palette" },
              { keys: ["?"], action: "Show this help" },
              { keys: ["g", "o"], action: "Go to Overview" },
              { keys: ["g", "j"], action: "Go to Jobs" },
              { keys: ["g", "p"], action: "Go to Pipeline" },
              { keys: ["g", "u"], action: "Go to Units" },
              { keys: ["g", "r"], action: "Go to Review" },
              { keys: ["g", "h"], action: "Go to Honeypots" },
              { keys: ["g", "q"], action: "Go to Quality" },
              { keys: ["g", "c"], action: "Go to Compare" },
              { keys: ["g", "a"], action: "Go to Architecture" },
              { keys: ["g", "e"], action: "Go to Export" },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{s.action}</span>
                <div className="flex gap-1">
                  {s.keys.map((k, j) => (
                    <kbd key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Review Queue</div>
            {[
              { keys: ["A"], action: "Accept unit" },
              { keys: ["E"], action: "Edit annotation" },
              { keys: ["R"], action: "Reject unit" },
              { keys: ["J"], action: "Next unit" },
              { keys: ["K"], action: "Previous unit" },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{s.action}</span>
                <div className="flex gap-1">
                  {s.keys.map((k, j) => (
                    <kbd key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
