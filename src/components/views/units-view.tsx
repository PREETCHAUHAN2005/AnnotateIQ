"use client";

import { useEffect, useMemo, useState } from "react";
import type { FinalRecord, Job } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  GitBranch,
  AlertTriangle,
  Clock,
  TableProperties,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "seq" | "confidence" | "chapter" | "difficulty";

export function UnitsView({ job }: { job: Job }) {
  const [finals, setFinals] = useState<FinalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState<"all" | "auto" | "human">("all");
  const [diffFilter, setDiffFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("seq");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<FinalRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getFinals(job.id)
      .then((r) => { if (!cancelled) setFinals(r.finals); })
      .catch((e) => { if (!cancelled) toast.error(e instanceof Error ? e.message : "load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [job.id]);

  const chapters = useMemo(
    () => Array.from(new Set(finals.map((f) => f.payload.chapter))).sort(),
    [finals]
  );

  const filtered = useMemo(() => {
    let out = [...finals];
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (f) =>
          f.payload.stem.toLowerCase().includes(q) ||
          f.payload.chapter.toLowerCase().includes(q) ||
          f.payload.concepts.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (routeFilter !== "all") out = out.filter((f) => f.route === routeFilter);
    if (diffFilter !== "all") out = out.filter((f) => f.payload.difficulty === diffFilter);

    out.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "seq": cmp = a.seq - b.seq; break;
        case "confidence": cmp = a.confidence - b.confidence; break;
        case "chapter": cmp = a.payload.chapter.localeCompare(b.payload.chapter); break;
        case "difficulty":
          cmp = { easy: 0, medium: 1, hard: 2 }[a.payload.difficulty] - { easy: 0, medium: 1, hard: 2 }[b.payload.difficulty];
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }, [finals, search, routeFilter, diffFilter, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  const autoCount = finals.filter((f) => f.route === "auto").length;
  const humanCount = finals.filter((f) => f.route === "human").length;
  const avgConf = finals.length ? finals.reduce((a, f) => a + f.confidence, 0) / finals.length : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TableProperties className="h-6 w-6 text-primary" /> Annotated Units
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse, search, and inspect every annotated unit in this job.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MiniStat label="Total" value={finals.length} />
          <MiniStat label="Auto" value={autoCount} tone="emerald" />
          <MiniStat label="Human" value={humanCount} tone="amber" />
          <MiniStat label="Avg conf" value={avgConf.toFixed(2)} tone="teal" />
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stem, chapter, or concepts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={routeFilter} onValueChange={(v) => setRouteFilter(v as typeof routeFilter)}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Route" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routes</SelectItem>
                <SelectItem value="auto">Auto-accept</SelectItem>
                <SelectItem value="human">Human review</SelectItem>
              </SelectContent>
            </Select>
            <Select value={diffFilter} onValueChange={setDiffFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search || routeFilter !== "all" || diffFilter !== "all") && (
            <div className="flex items-center gap-2 mt-3 text-xs">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Showing {filtered.length} of {finals.length} units
              </span>
              <button
                onClick={() => { setSearch(""); setRouteFilter("all"); setDiffFilter("all"); }}
                className="text-primary hover:underline ml-1"
              >
                clear filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No units match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left p-3 font-medium">
                      <SortButton label="#" active={sortKey === "seq"} asc={sortAsc} onClick={() => toggleSort("seq")} />
                    </th>
                    <th className="text-left p-3 font-medium">Stem</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">
                      <SortButton label="Chapter" active={sortKey === "chapter"} asc={sortAsc} onClick={() => toggleSort("chapter")} />
                    </th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      <SortButton label="Diff" active={sortKey === "difficulty"} asc={sortAsc} onClick={() => toggleSort("difficulty")} />
                    </th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Bloom</th>
                    <th className="text-right p-3 font-medium">
                      <SortButton label="Conf" active={sortKey === "confidence"} asc={sortAsc} onClick={() => toggleSort("confidence")} />
                    </th>
                    <th className="text-center p-3 font-medium">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelected(f)}
                      className="border-b border-border/40 hover:bg-accent/30 cursor-pointer transition group"
                    >
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>#{f.seq}</span>
                          {f.isHoneypot && <AlertTriangle className="h-3 w-3 text-foreground/60" />}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="truncate text-foreground/90 group-hover:text-primary transition">
                          {f.payload.stem.slice(0, 80)}{f.payload.stem.length > 80 ? "…" : ""}
                        </div>
                        {f.payload.concepts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {f.payload.concepts.slice(0, 2).map((c, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 hidden md:table-cell text-xs">{f.payload.chapter}</td>
                      <td className="p-3 hidden lg:table-cell">
                        <DiffBadge difficulty={f.payload.difficulty} />
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">{f.payload.bloom}</span>
                      </td>
                      <td className="p-3 text-right">
                        <ConfidenceBar value={f.confidence} />
                      </td>
                      <td className="p-3 text-center">
                        {f.route === "auto" ? (
                          <Badge variant="outline" className="gap-1 border-foreground/30 text-foreground">
                            <CheckCircle2 className="h-3 w-3" /> auto
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-foreground/20 text-foreground/60">
                            <GitBranch className="h-3 w-3" /> human
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4 text-primary" />
                  Unit #{selected.seq}
                  {selected.isHoneypot && (
                    <Badge variant="outline" className="gap-1 border-foreground/20 text-foreground/60 ml-2">
                      <AlertTriangle className="h-3 w-3" /> honeypot
                    </Badge>
                  )}
                  {selected.route === "auto" ? (
                    <Badge variant="outline" className="gap-1 border-foreground/30 text-foreground ml-auto">
                      <CheckCircle2 className="h-3 w-3" /> auto-accepted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-foreground/20 text-foreground/60 ml-auto">
                      <GitBranch className="h-3 w-3" /> human review
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Question stem</div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-sm leading-relaxed">
                    {selected.payload.stem}
                  </div>
                  {selected.payload.options && (
                    <div className="mt-2 space-y-1">
                      {selected.payload.options.map((o, i) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground pl-3">
                          ({String.fromCharCode(97 + i)}) {o}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DetailItem label="Chapter" value={selected.payload.chapter} />
                  <DetailItem label="Difficulty" value={selected.payload.difficulty} />
                  <DetailItem label="Bloom level" value={selected.payload.bloom} />
                  <DetailItem label="Language" value={selected.payload.language} />
                  <DetailItem label="Has equation" value={String(selected.payload.has_equation)} />
                  <DetailItem label="Code-mix ratio" value={selected.payload.code_mix_ratio.toFixed(2)} />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Concepts</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.payload.concepts.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>

                {selected.payload.latex.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">LaTeX</div>
                    <div className="space-y-1">
                      {selected.payload.latex.map((l, i) => (
                        <code key={i} className="block p-2 rounded bg-muted/60 text-xs font-mono text-primary">{l}</code>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Difficulty rationale</div>
                  <div className="p-2 rounded bg-muted/40 text-xs italic text-foreground/80">
                    "{selected.payload.difficulty_rationale}"
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence:</span>
                    <span className="font-mono text-sm text-primary">{selected.confidence.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Agreement:</span>
                    <span className="font-mono text-sm text-foreground/80">{selected.agreement.toFixed(2)}</span>
                  </div>
                </div>

                {selected.reviewerAction && (
                  <div className="flex items-center gap-2 text-xs pt-2 border-t border-border/60">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Reviewed:</span>
                    <Badge variant="outline" className="text-xs">{selected.reviewerAction}</Badge>
                    {selected.reviewedBy && <span className="text-muted-foreground">by {selected.reviewedBy}</span>}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: "emerald" | "amber" | "teal" }) {
  const cls = {
    emerald: "text-foreground",
    amber: "text-foreground/60",
    teal: "text-foreground/80",
  }[tone ?? "" as never] ?? "text-foreground";
  return (
    <div className="text-center px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40">
      <div className={cn("text-sm font-bold tabular-nums", cls)}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SortButton({ label, active, asc, onClick }: { label: string; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1 hover:text-foreground transition", active && "text-primary")}>
      {label}
      <ArrowUpDown className={cn("h-3 w-3", active && asc && "text-primary", active && !asc && "text-primary rotate-180")} />
    </button>
  );
}

function DiffBadge({ difficulty }: { difficulty: string }) {
  const cls = {
    easy: "border-foreground/30 text-foreground bg-foreground/5",
    medium: "border-foreground/20 text-foreground/60 bg-foreground/5",
    hard: "border-rose-500/40 text-rose-400 bg-rose-500/5",
  }[difficulty] ?? "";
  return <Badge variant="outline" className={cn("text-xs capitalize", cls)}>{difficulty}</Badge>;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = value * 100;
  const color = value >= 0.85 ? "bg-foreground" : value >= 0.6 ? "bg-foreground/50" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums w-10 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
