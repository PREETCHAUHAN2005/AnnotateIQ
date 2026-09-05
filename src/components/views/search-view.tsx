"use client";

import { useEffect, useState } from "react";
import type { SearchResult } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Hash,
  CheckCircle2,
  GitBranch,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchView({
  onOpenResult,
}: {
  onOpenResult?: (jobId: string, unitId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      api
        .search(query)
        .then((r) => {
          setResults(r.results);
          setHasSearched(true);
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "search failed"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const suggestions = ["HIGH", "CRITICAL", "ALLOW", "REJECT", "geo_mismatch", "device_reuse", "velocity", "RING_DEV"];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" /> Global Search
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search annotated events by transaction id, merchant, risk label, action, factors, cluster id, or explanation.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events… (e.g. HIGH, REJECT, geo_mismatch, TX_10001)"
              className="pl-11 h-12 text-base"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Try:
            </span>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-xs px-2 py-1 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/40 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="text-foreground font-medium">&quot;{query}&quot;</span>
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-3">
          {results.map((r) => (
            <ResultCard
              key={r.finalId}
              result={r}
              query={query}
              onOpen={() => onOpenResult?.(r.jobId, r.unitId)}
            />
          ))}
        </div>
      )}

      {hasSearched && results.length === 0 && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No results found for &quot;{query}&quot;</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different keyword or check spelling.</p>
          </CardContent>
        </Card>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Start typing to search across all events</p>
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 2 characters. Searches transaction id, merchant, risk label, action, factors, and explanation.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultCard({
  result,
  query,
  onOpen,
}: {
  result: SearchResult;
  query: string;
  onOpen?: () => void;
}) {
  const highlight = (text: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/30 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <Card
      className={cn("border-border/60 card-hover", onOpen && "cursor-pointer")}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            {result.route === "auto" ? (
              <div className="rounded-lg bg-foreground/10 border border-foreground/25 p-2">
                <CheckCircle2 className="h-4 w-4 text-foreground" />
              </div>
            ) : (
              <div className="rounded-lg bg-foreground/10 border border-foreground/20 p-2">
                <GitBranch className="h-4 w-4 text-foreground/60" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge variant="outline" className="text-[10px] font-mono gap-1">
                <Hash className="h-2.5 w-2.5" />#{result.seq}
              </Badge>
              {result.isHoneypot && (
                <Badge variant="outline" className="text-[10px] gap-1 border-foreground/20 text-foreground/60">
                  <AlertTriangle className="h-2.5 w-2.5" /> honeypot
                </Badge>
              )}
              {result.matchedFields.map((f) => (
                <Badge key={f} variant="outline" className="text-[9px] bg-primary/5 border-primary/20 text-primary">
                  {f}
                </Badge>
              ))}
              <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                conf {result.confidence.toFixed(2)}
              </span>
            </div>

            <p className="text-sm text-foreground/90 line-clamp-2 mb-2">
              {highlight((result.payload.explanation ?? result.payload.event?.transaction_id ?? "").slice(0, 200))}
            </p>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-primary font-medium font-mono">{highlight(result.payload.risk_label)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono">{result.payload.recommended_action}</span>
              <span className="text-muted-foreground">·</span>
              <span className={cn(result.payload.consensus === "DISPUTED" ? "text-rose-400" : "text-muted-foreground")}>
                {result.payload.consensus}
              </span>
              {(result.payload.risk_factors ?? []).length > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{result.payload.risk_factors.slice(0, 2).join(", ")}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
