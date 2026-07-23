"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { CommandPalette, KeyboardShortcutsHelp } from "@/components/command-palette";
import { OverviewView } from "@/components/views/overview-view";

// Lazy-load heavy views to reduce initial compile memory footprint.
const JobsView = dynamic(() => import("@/components/views/jobs-view").then((m) => m.JobsView), { ssr: false });
const PipelineView = dynamic(() => import("@/components/views/pipeline-view").then((m) => m.PipelineView), { ssr: false });
const UnitsView = dynamic(() => import("@/components/views/units-view").then((m) => m.UnitsView), { ssr: false });
const ReviewView = dynamic(() => import("@/components/views/review-view").then((m) => m.ReviewView), { ssr: false });
const QualityView = dynamic(() => import("@/components/views/quality-view").then((m) => m.QualityView), { ssr: false });
const HoneypotView = dynamic(() => import("@/components/views/honeypot-view").then((m) => m.HoneypotView), { ssr: false });
const CompareView = dynamic(() => import("@/components/views/compare-view").then((m) => m.CompareView), { ssr: false });
const InsightsView = dynamic(() => import("@/components/views/insights-view").then((m) => m.InsightsView), { ssr: false });
const TaxonomyView = dynamic(() => import("@/components/views/taxonomy-view").then((m) => m.TaxonomyView), { ssr: false });
const SearchView = dynamic(() => import("@/components/views/search-view").then((m) => m.SearchView), { ssr: false });
const ActivityView = dynamic(() => import("@/components/views/activity-view").then((m) => m.ActivityView), { ssr: false });
const ArchitectureView = dynamic(() => import("@/components/views/architecture-view").then((m) => m.ArchitectureView), { ssr: false });
const ExportView = dynamic(() => import("@/components/views/export-view").then((m) => m.ExportView), { ssr: false });

export type ViewKey = "overview" | "jobs" | "pipeline" | "units" | "review" | "honeypot" | "quality" | "compare" | "insights" | "taxonomy" | "search" | "activity" | "architecture" | "export";

export default function Home() {
  const [view, setView] = useState<ViewKey>("overview");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  const refreshJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { jobs } = await api.listJobs();
      setJobs(jobs);
      if (!activeJobId && jobs.length) setActiveJobId(jobs[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingJobs(false);
    }
  }, [activeJobId]);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  // poll jobs list every 6s so status updates flow in
  useEffect(() => {
    const t = setInterval(refreshJobs, 6000);
    return () => clearInterval(t);
  }, [refreshJobs]);

  // keyboard shortcuts: Cmd+K (palette), ? (help), g+key (view nav)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      if (isInput) return;

      // Cmd/Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // ? → help overlay
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      // g + key → navigate to view
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        setGPressed(true);
        setTimeout(() => setGPressed(false), 1000);
        return;
      }
      if (gPressed) {
        const map: Record<string, ViewKey> = {
          o: "overview",
          j: "jobs",
          p: "pipeline",
          u: "units",
          r: "review",
          h: "honeypot",
          q: "quality",
          c: "compare",
          i: "insights",
          t: "taxonomy",
          s: "search",
          y: "activity",
          a: "architecture",
          e: "export",
        };
        const v = map[e.key.toLowerCase()];
        if (v) {
          e.preventDefault();
          setView(v);
        }
        setGPressed(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gPressed]);

  const activeJob = jobs.find((j) => j.id === activeJobId) ?? null;

  const handleSelectJob = (id: string) => {
    setActiveJobId(id);
  };

  const handleJobCreated = (job: Job) => {
    setJobs((prev) => [job, ...prev]);
    setActiveJobId(job.id);
  };

  const handleJobDeleted = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (activeJobId === id) {
      setActiveJobId(null);
    }
  };

  const navigateWithJob = (v: ViewKey, jobId?: string) => {
    if (jobId) setActiveJobId(jobId);
    setView(v);
  };

  return (
    <>
    <AppShell
      view={view}
      onViewChange={setView}
      jobs={jobs}
      activeJob={activeJob}
      onSelectJob={handleSelectJob}
      onRefreshJobs={refreshJobs}
      loadingJobs={loadingJobs}
    >
      {view === "overview" && (
        <OverviewView
          jobs={jobs}
          onGoToJobs={() => setView("jobs")}
          onSelectJob={(id) => navigateWithJob("pipeline", id)}
        />
      )}
      {view === "jobs" && (
        <JobsView
          jobs={jobs}
          activeJobId={activeJobId}
          onSelectJob={handleSelectJob}
          onJobCreated={handleJobCreated}
          onRunPipeline={(id) => navigateWithJob("pipeline", id)}
          onDeleteJob={handleJobDeleted}
        />
      )}
      {view === "pipeline" && activeJob && (
        <PipelineView job={activeJob} onGoToReview={() => setView("review")} onGoToQuality={() => setView("quality")} />
      )}
      {view === "pipeline" && !activeJob && (
        <EmptyState message="Create or select a job to view the live pipeline." action={() => setView("jobs")} actionLabel="Go to Jobs" />
      )}
      {view === "units" && activeJob && <UnitsView job={activeJob} />}
      {view === "units" && !activeJob && (
        <EmptyState message="Select a job to view annotated units." action={() => setView("jobs")} actionLabel="Go to Jobs" />
      )}
      {view === "review" && activeJob && <ReviewView job={activeJob} />}
      {view === "review" && !activeJob && (
        <EmptyState message="Select a job to review." action={() => setView("jobs")} actionLabel="Go to Jobs" />
      )}
      {view === "honeypot" && activeJob && <HoneypotView job={activeJob} />}
      {view === "honeypot" && !activeJob && (
        <EmptyState message="Select a job to inspect honeypots." action={() => setView("jobs")} actionLabel="Go to Jobs" />
      )}
      {view === "quality" && activeJob && <QualityView job={activeJob} />}
      {view === "quality" && !activeJob && (
        <EmptyState message="Select a job to view quality." action={() => setView("jobs")} actionLabel="Go to Jobs" />
      )}
      {view === "compare" && <CompareView />}
      {view === "insights" && <InsightsView />}
      {view === "taxonomy" && <TaxonomyView />}
      {view === "search" && <SearchView />}
      {view === "activity" && <ActivityView />}
      {view === "architecture" && <ArchitectureView />}
      {view === "export" && activeJob && <ExportView job={activeJob} />}
      {view === "export" && !activeJob && (
        <EmptyState message="Select a job to export." action={() => setView("jobs")} actionLabel="Go to Jobs" />
      )}
    </AppShell>
    <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onViewChange={setView} />
    <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

function EmptyState({ message, action, actionLabel }: { message: string; action: () => void; actionLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center">
      <p className="text-muted-foreground">{message}</p>
      <button
        onClick={action}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
      >
        {actionLabel}
      </button>
    </div>
  );
}
