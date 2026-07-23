"use client";

import { useEffect, useState } from "react";
import type { Job, FinalRecord } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileJson, FileText, FileSpreadsheet, Loader2, CheckCircle2, Filter, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ExportView({ job }: { job: Job }) {
  const [finals, setFinals] = useState<FinalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getFinals(job.id)
      .then((r) => setFinals(r.finals))
      .catch((e) => toast.error(e instanceof Error ? e.message : "load failed"))
      .finally(() => setLoading(false));
  }, [job.id]);

  const eligible = finals.filter(
    (f) => f.route === "auto" || f.reviewerAction === "accept" || f.reviewerAction === "edit"
  );
  const excluded = finals.filter(
    (f) => !(f.route === "auto" || f.reviewerAction === "accept" || f.reviewerAction === "edit")
  );

  const copyToClipboard = async () => {
    const jsonl = eligible
      .map((f) => JSON.stringify({ ...f.payload, reviewed_by: f.reviewedBy, reviewer_action: f.reviewerAction ?? "auto" }))
      .join("\n");
    try {
      await navigator.clipboard.writeText(jsonl);
      setCopied(true);
      toast.success(`Copied ${eligible.length} rows to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ML-ready dataset. Only rows where <code className="text-primary text-xs">route=&apos;auto&apos;</code> OR{" "}
          <code className="text-primary text-xs">reviewer_action IN (&apos;accept&apos;,&apos;edit&apos;)</code>.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total finals</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{finals.length}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Eligible
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-emerald-400">{eligible.length}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-400/30">
          <CardContent className="p-4">
            <div className="text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="h-3 w-3" /> Excluded
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-amber-400">{excluded.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="gap-2">
          <a href={api.exportUrl(job.id, "jsonl")} download>
            <FileText className="h-4 w-4" /> Download JSONL
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <a href={api.exportUrl(job.id, "json")} download>
            <FileJson className="h-4 w-4" /> Download JSON
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <a href={api.exportUrl(job.id, "csv")} download>
            <FileSpreadsheet className="h-4 w-4" /> Download CSV
          </a>
        </Button>
      </div>

      {/* Schema preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dataset schema</CardTitle>
          <CardDescription>Fields in each exported record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { field: "unit_id", type: "string", desc: "unique unit identifier" },
              { field: "stem", type: "string", desc: "question text" },
              { field: "options", type: "string[]", desc: "MCQ options or null" },
              { field: "chapter", type: "string", desc: "NCERT chapter (closed vocab)" },
              { field: "concepts", type: "string[]", desc: "1-4 key concepts" },
              { field: "difficulty", type: "enum", desc: "easy | medium | hard" },
              { field: "bloom", type: "enum", desc: "remember | understand | apply | analyze" },
              { field: "difficulty_rationale", type: "string", desc: "grounded quote from stem" },
              { field: "latex", type: "string[]", desc: "LaTeX expressions" },
              { field: "has_equation", type: "boolean", desc: "contains math" },
              { field: "language", type: "enum", desc: "en | hi | hinglish" },
              { field: "code_mix_ratio", type: "float", desc: "0.0-1.0" },
              { field: "confidence", type: "float", desc: "weakest-link score" },
              { field: "agreement", type: "float", desc: "min field agreement" },
              { field: "route", type: "enum", desc: "auto | human" },
              { field: "reviewer_action", type: "enum", desc: "accept | edit | reject | auto" },
            ].map((f) => (
              <div key={f.field} className="p-2.5 rounded-lg border border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-primary">{f.field}</code>
                  <span className="text-[9px] text-muted-foreground font-mono px-1 py-0.5 rounded bg-muted">{f.type}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Preview · JSONL</CardTitle>
              <CardDescription>First 10 eligible rows</CardDescription>
            </div>
            {eligible.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="gap-1.5 shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy JSONL"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No eligible rows yet. Run the pipeline and review units.
            </p>
          ) : (
            <ScrollArea className="h-[420px]">
              <pre className="text-[11px] font-mono leading-relaxed p-3 space-y-2">
                {eligible.slice(0, 10).map((f) => {
                  const jsonStr = JSON.stringify({ ...f.payload, reviewed_by: f.reviewedBy, reviewer_action: f.reviewerAction ?? "auto" }, null, 2);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "p-2 rounded border border-border/40 bg-muted/30",
                        f.reviewerAction === "edit" && "border-teal-400/30",
                        f.reviewerAction === "accept" && "border-emerald-500/20"
                      )}
                    >
                      <span className="text-muted-foreground">{"{"}</span>
                      <br />
                      {Object.entries({ ...f.payload, reviewed_by: f.reviewedBy, reviewer_action: f.reviewerAction ?? "auto" }).map(([k, v], i, arr) => (
                        <span key={k}>
                          {"  "}<span className="text-primary">"{k}"</span>: <span className={cn(typeof v === "string" ? "text-amber-400" : typeof v === "number" ? "text-teal-400" : "text-violet-400")}>{JSON.stringify(v)}</span>{i < arr.length - 1 ? "," : ""}
                          <br />
                        </span>
                      ))}
                      <span className="text-muted-foreground">{"}"}</span>
                    </div>
                  );
                })}
              </pre>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Excluded rows */}
      {excluded.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-amber-400" /> Excluded rows
            </CardTitle>
            <CardDescription>Rejected or unreviewed human-routed units — not in the export.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {excluded.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 text-sm">
                  <Badge variant="outline" className="font-mono text-[10px]">#{f.seq}</Badge>
                  <span className="flex-1 truncate">{f.payload.chapter}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.reviewerAction === "reject" ? "rejected" : "unreviewed"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
