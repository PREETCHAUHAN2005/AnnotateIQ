"use client";

import { useState } from "react";
import type { Job } from "@/lib/types";
import { api } from "@/lib/api";
import { SAMPLE_PAPERS } from "@/lib/data/sample-papers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Play, FileUp, ScanLine, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function JobsView({
  jobs,
  activeJobId,
  onSelectJob,
  onJobCreated,
  onRunPipeline,
}: {
  jobs: Job[];
  activeJobId: string | null;
  onSelectJob: (id: string) => void;
  onJobCreated: (job: Job) => void;
  onRunPipeline: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);

  const createSample = async (paperId: string) => {
    setCreating(true);
    try {
      const { job } = await api.createJob({ mode: "sample", paperId });
      onJobCreated(job);
      toast.success(`Created job from ${job.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs & Upload</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a job from a curated JEE Physics paper or paste raw text. Each job is segmented into
          units and run through the multi-agent pipeline.
        </p>
      </div>

      <Tabs defaultValue="sample">
        <TabsList>
          <TabsTrigger value="sample" className="gap-2">
            <FileText className="h-4 w-4" /> Sample papers
          </TabsTrigger>
          <TabsTrigger value="paste" className="gap-2">
            <FileUp className="h-4 w-4" /> Paste text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sample" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAMPLE_PAPERS.map((p) => {
              const Icon = p.kind === "clean" ? FileText : p.kind === "scanned" ? ScanLine : ImageIcon;
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
                          <Badge variant="outline" className="text-[10px]">{p.units.length} questions</Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      className="w-full mt-4 gap-2"
                      onClick={() => createSample(p.id)}
                      disabled={creating}
                    >
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Create job
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-4">
          <PasteForm onJobCreated={onJobCreated} />
        </TabsContent>
      </Tabs>

      {/* Job list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All jobs</CardTitle>
          <CardDescription>{jobs.length} job{jobs.length !== 1 ? "s" : ""} total</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No jobs yet. Create one above.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  active={j.id === activeJobId}
                  onSelect={() => onSelectJob(j.id)}
                  onRun={() => onRunPipeline(j.id)}
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
  const [filename, setFilename] = useState("pasted-paper.txt");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (text.trim().length < 10) {
      toast.error("Paste at least one numbered question.");
      return;
    }
    setLoading(true);
    try {
      const { job } = await api.createJob({ mode: "paste", text, filename });
      onJobCreated(job);
      toast.success(`Created job with ${job.unitCount} units`);
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
          <Label htmlFor="ptext">Raw paper text</Label>
          <Textarea
            id="ptext"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Paste questions here. Number them like:\n1. A body moves with velocity...\n2. A charge q is placed...\n3. ..."}
            className="min-h-[200px] font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Segmenter: regex on <code className="text-primary">^\s*(\d{"{1,3}"})[.)]\s</code>
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
  onSelect,
  onRun,
}: {
  job: Job;
  active: boolean;
  onSelect: () => void;
  onRun: () => void;
}) {
  const canRun = job.status === "pending" || job.status === "failed";
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition",
        active ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-accent/30"
      )}
    >
      <button onClick={onSelect} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <StatusPill status={job.status} />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{job.filename}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {job.unitCount} units · {job.autoCount} auto · {job.humanCount} human · {job.reviewedCount} reviewed
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
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "pending", cls: "bg-muted text-muted-foreground" },
    extracting: { label: "extracting", cls: "bg-primary/15 text-primary" },
    labeling: { label: "labeling", cls: "bg-primary/15 text-primary" },
    review: { label: "review", cls: "bg-amber-400/15 text-amber-400" },
    done: { label: "done", cls: "bg-emerald-500/15 text-emerald-400" },
    failed: { label: "failed", cls: "bg-rose-500/15 text-rose-400" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("text-[10px] font-mono px-2 py-1 rounded-md shrink-0", s.cls)}>{s.label}</span>;
}
