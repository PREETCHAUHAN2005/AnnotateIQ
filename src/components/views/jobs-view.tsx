"use client";

import { useEffect, useState } from "react";
import type { IeeeDatasetInfo, Job } from "@/lib/types";
import { api } from "@/lib/api";
import { IEEE_COLUMN_MAP } from "@/lib/data/ieee-columns";
import { FAILURE_BATCHES } from "@/lib/data/sample-failures";
import { SAMPLE_BATCHES } from "@/lib/data/sample-transactions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Play, FileUp, ScanLine, ShieldAlert, Loader2, Trash2, Database, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export function JobsView({
  jobs,
  activeJobId,
  onSelectJob,
  onJobCreated,
  onRunPipeline,
  onDeleteJob,
}: {
  jobs: Job[];
  activeJobId: string | null;
  onSelectJob: (id: string) => void;
  onJobCreated: (job: Job) => void;
  onRunPipeline: (id: string) => void;
  onDeleteJob: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ieee, setIeee] = useState<IeeeDatasetInfo | null>(null);

  useEffect(() => {
    api.getIeeeDataset().then(setIeee).catch(() => setIeee(null));
  }, []);

  const createSample = async (packId: string) => {
    setCreating(true);
    try {
      const { job } = await api.createJob({ mode: "sample", packId });
      onJobCreated(job);
      toast.success(`Created job from ${job.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const createIeee = async () => {
    setCreating(true);
    try {
      const { job } = await api.createJob({ mode: "ieee" });
      onJobCreated(job);
      toast.success(`Created IEEE-CIS-shaped job (${job.unitCount} events)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "IEEE load failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Delete job "${filename}"? This removes all its units, drafts, and finals.`)) return;
    setDeletingId(id);
    try {
      await api.deleteJob(id);
      onDeleteJob(id);
      toast.success("Job deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs & ingest</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a risk or payment-failure batch from synthetic packs, paste or upload JSON/CSV, or load an
          IEEE-CIS-shaped fixture. Public/synthetic data only — not Razorpay production transactions. This app never
          downloads Kaggle.
        </p>
      </div>

      <Tabs defaultValue="sample">
        <TabsList>
          <TabsTrigger value="sample" className="gap-2">
            <FileText className="h-4 w-4" /> Dummy packs
          </TabsTrigger>
          <TabsTrigger value="paste" className="gap-2">
            <FileUp className="h-4 w-4" /> Paste / upload
          </TabsTrigger>
          <TabsTrigger value="failure" className="gap-2">
            <Timer className="h-4 w-4" /> Failure packs
          </TabsTrigger>
          <TabsTrigger value="ieee" className="gap-2">
            <Database className="h-4 w-4" /> IEEE-CIS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sample" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAMPLE_BATCHES.map((p) => {
              const Icon = p.kind === "clean" ? FileText : p.kind === "velocity" ? ScanLine : ShieldAlert;
              return (
                <Card key={p.id} className="border-border/60 hover:border-primary/40 transition group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.filename}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
                          <Badge variant="outline" className="text-[10px]">{p.units.length} events</Badge>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full mt-4 gap-2" onClick={() => createSample(p.id)} disabled={creating}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Create job
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="failure" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FAILURE_BATCHES.map((p) => (
              <Card key={p.id} className="border-border/60 hover:border-primary/40 transition group">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition">
                      <Timer className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{p.filename}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.units.length} events</Badge>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full mt-4 gap-2" onClick={() => createSample(p.id)} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Create job
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-4">
          <PasteForm onJobCreated={onJobCreated} />
        </TabsContent>

        <TabsContent value="ieee" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="font-medium text-sm">IEEE-CIS shaped fixture</div>
              <p className="text-xs text-muted-foreground">
                This app never downloads Kaggle. Drop JSON or CSV at <code className="text-primary">data/ieee-cis-sample.json</code>{" "}
                (or paste/upload on the other tab). Optional identity join:{" "}
                <code className="text-primary">data/ieee-cis-identity.json</code> on TransactionID. Cap is 400 events / 1.5 MB.
              </p>
              <p className="text-xs text-muted-foreground">{ieee?.message ?? "Checking fixture…"}</p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <Badge variant="outline">{ieee?.count ?? 0} txn rows</Badge>
                <Badge variant="outline">
                  identity {ieee?.identityAvailable ? `${ieee.identityCount ?? 0} rows` : "not dropped"}
                </Badge>
                <Badge variant="outline">isFraud gold {ieee?.fraudGoldCount ?? 0} (honeypot only)</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                <code className="text-primary">isFraud</code> becomes honeypot gold only. Specialists never see it, and it is
                never exported as <code className="text-primary">risk_label</code>.
              </p>
              <Button onClick={createIeee} disabled={creating || !ieee?.available} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Load IEEE-CIS sample ({ieee?.count ?? 0} rows)
              </Button>
              <div className="pt-2 border-t border-border/60">
                <div className="text-xs font-medium mb-2">Column map</div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {IEEE_COLUMN_MAP.map((row) => (
                    <div key={row.ieee} className="text-[10px] font-mono leading-relaxed">
                      <span className="text-primary">{row.ieee}</span>
                      <span className="text-muted-foreground"> → {row.canonical}</span>
                      {row.notes ? <span className="text-muted-foreground"> · {row.notes}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All jobs</CardTitle>
          <CardDescription>
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No jobs yet. Create one above.</div>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  active={j.id === activeJobId}
                  deleting={deletingId === j.id}
                  onSelect={() => onSelectJob(j.id)}
                  onRun={() => onRunPipeline(j.id)}
                  onDelete={() => handleDelete(j.id, j.filename)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PasteForm({ onJobCreated }: { onJobCreated: (job: Job) => void }) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("pasted-events.json");
  const [loading, setLoading] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      toast.error("File too large (cap 1.5 MB). Split it locally — no Kaggle dump ingest.");
      return;
    }
    const body = await file.text();
    setFilename(file.name || "uploaded-events");
    setText(body);
  };

  const submit = async () => {
    if (text.trim().length < 2) {
      toast.error("Paste or upload a JSON array or IEEE-shaped CSV.");
      return;
    }
    setLoading(true);
    try {
      const { job } = await api.createJob({ mode: "paste", text, filename });
      onJobCreated(job);
      toast.success(`Created job with ${job.unitCount} events`);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fname">Filename</Label>
          <Input id="fname" value={filename} onChange={(e) => setFilename(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pfile">Upload JSON or CSV</Label>
          <Input
            id="pfile"
            type="file"
            accept=".json,.csv,.txt,application/json,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ptext">JSON array, IEEE object, or CSV</Label>
          <Textarea
            id="ptext"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'TransactionID,TransactionAmt,ProductCD,isFraud\n2987000,68.5,W,0\n\nor JSON:\n[{"transaction_id":"TX_1","amount":1200}]'}
            className="min-h-[200px] font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Same normalizer as the IEEE fixture. Optional{" "}
            <code className="text-primary">{`{ "transactions": [], "identity": [] }`}</code> join.{" "}
            <code className="text-primary">isFraud</code> is stripped from stored events and used as honeypot gold only.
            Cap 400 events / 1.5 MB.
          </p>
        </div>
        <Button onClick={submit} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Create job
        </Button>
      </CardContent>
    </Card>
  );
}

function JobRow({
  job,
  active,
  deleting,
  onSelect,
  onRun,
  onDelete,
}: {
  job: Job;
  active: boolean;
  deleting: boolean;
  onSelect: () => void;
  onRun: () => void;
  onDelete: () => void;
}) {
  const canRun = job.status === "pending" || job.status === "failed";
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition group",
        active ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-accent/30",
        deleting && "opacity-50"
      )}
    >
      <button onClick={onSelect} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <StatusPill status={job.status} />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{job.filename}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {job.kind === "failure" ? "failure" : "risk"} · {job.unitCount} events · {job.autoCount} auto ·{" "}
            {job.humanCount} human · {job.reviewedCount} reviewed
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2 sm:ml-auto">
        {canRun && (
          <Button size="sm" variant="default" onClick={onRun} className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Run pipeline
          </Button>
        )}
        {(job.status === "review" || job.status === "done") && (
          <Button size="sm" variant="outline" onClick={onSelect} className="gap-1.5">
            View
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={deleting}
          className="gap-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition"
          title="Delete job"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "pending", cls: "bg-muted text-muted-foreground" },
    extracting: { label: "extracting", cls: "bg-primary/15 text-primary" },
    labeling: { label: "labeling", cls: "bg-primary/15 text-primary" },
    review: { label: "review", cls: "bg-foreground/15 text-foreground/60" },
    done: { label: "done", cls: "bg-foreground/15 text-foreground" },
    failed: { label: "failed", cls: "bg-rose-500/15 text-rose-400" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("text-[10px] font-mono px-2 py-1 rounded-md shrink-0", s.cls)}>{s.label}</span>;
}
