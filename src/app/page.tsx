"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { CommandPalette, KeyboardShortcutsHelp } from "@/components/command-palette";
import { OnboardingTour } from "@/components/onboarding-tour";
import { OverviewView } from "@/components/views/overview-view";
import { CardSkeleton, TableSkeleton } from "@/components/skeleton";

const viewFallback = (
  <div className="space-y-4 p-1">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <TableSkeleton rows={4} />
  </div>
);

const JobsView = dynamic(() => import("@/components/views/jobs-view").then((m) => m.JobsView), {
  ssr: false,
  loading: () => viewFallback,
});
const PipelineView = dynamic(() => import("@/components/views/pipeline-view").then((m) => m.PipelineView), {
  ssr: false,
  loading: () => viewFallback,
});
const UnitsView = dynamic(() => import("@/components/views/units-view").then((m) => m.UnitsView), {
  ssr: false,
  loading: () => viewFallback,
});
const ReviewView = dynamic(() => import("@/components/views/review-view").then((m) => m.ReviewView), {
  ssr: false,
  loading: () => viewFallback,
});
const QualityView = dynamic(() => import("@/components/views/quality-view").then((m) => m.QualityView), {
  ssr: false,
  loading: () => viewFallback,
});
const HoneypotView = dynamic(() => import("@/components/views/honeypot-view").then((m) => m.HoneypotView), {
  ssr: false,
  loading: () => viewFallback,
});
const CompareView = dynamic(() => import("@/components/views/compare-view").then((m) => m.CompareView), {
  ssr: false,
  loading: () => viewFallback,
});
const InsightsView = dynamic(() => import("@/components/views/insights-view").then((m) => m.InsightsView), {
  ssr: false,
  loading: () => viewFallback,
});
const TaxonomyView = dynamic(() => import("@/components/views/taxonomy-view").then((m) => m.TaxonomyView), {
  ssr: false,
  loading: () => viewFallback,
});
const SearchView = dynamic(() => import("@/components/views/search-view").then((m) => m.SearchView), {
  ssr: false,
  loading: () => viewFallback,
});
const ActivityView = dynamic(() => import("@/components/views/activity-view").then((m) => m.ActivityView), {
  ssr: false,
  loading: () => viewFallback,
});
const ArchitectureView = dynamic(
  () => import("@/components/views/architecture-view").then((m) => m.ArchitectureView),
  { ssr: false, loading: () => viewFallback }
);
const ExportView = dynamic(() => import("@/components/views/export-view").then((m) => m.ExportView), {
  ssr: false,
  loading: () => viewFallback,
});

export type ViewKey =
  | "overview"
  | "jobs"
  | "pipeline"
  | "units"
  | "review"
  | "honeypot"
  | "quality"
  | "compare"
  | "insights"
  | "taxonomy"
  | "search"
  | "activity"
  | "architecture"
  | "export";

const VALID_VIEWS: ViewKey[] = [
  "overview",
  "jobs",
  "pipeline",
  "units",
  "review",
  "honeypot",
  "quality",
  "compare",
  "insights",
  "taxonomy",
  "search",
  "activity",
  "architecture",
  "export",
];

function readUrlState(): { view: ViewKey; job: string | null } {
  if (typeof window === "undefined") return { view: "overview", job: null };
  const params = new URLSearchParams(window.location.search);
  const v = params.get("view") as ViewKey | null;
  return {
    view: v && VALID_VIEWS.includes(v) ? v : "overview",
    job: params.get("job"),
  };
}

export default function Home() {
  const initial = typeof window !== "undefined" ? readUrlState() : { view: "overview" as ViewKey, job: null };
  const [view, setView] = useState<ViewKey>(initial.view);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(initial.job);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);
  const [autoStartPipeline, setAutoStartPipeline] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  // hydrate from URL on mount (SSR-safe)
  useEffect(() => {
    const { view: v, job } = readUrlState();
    setView(v);
    if (job) setActiveJobId(job);
    setUrlReady(true);
  }, []);

  // keep URL in sync for deep links / refresh
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (view !== "overview") params.set("view", view);
    if (activeJobId) params.set("job", activeJobId);
    const qs = params.toString();
    const next = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, [view, activeJobId, urlReady]);

  const refreshJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { jobs: list } = await api.listJobs();
      setJobs(list);
      setActiveJobId((prev) => {
        if (prev && list.some((j) => j.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    const t = setInterval(refreshJobs, 6000);
    return () => clearInterval(t);
  }, [refreshJobs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

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
        const next = map[e.key.toLowerCase()];
        if (next) {
          e.preventDefault();
          setView(next);
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
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      setActiveJobId((cur) => {
        if (cur !== id) return cur;
        return next[0]?.id ?? null;
      });
      return next;
    });
  };

  const navigateWithJob = (v: ViewKey, jobId?: string) => {
    if (jobId) setActiveJobId(jobId);
    setView(v);
  };

  const handleRunPipeline = (id: string) => {
    setActiveJobId(id);
    setAutoStartPipeline(true);
    setView("pipeline");
  };

  const handleJobStatus = (patch: Partial<Job> & { id: string }) => {
    setJobs((prev) => prev.map((j) => (j.id === patch.id ? { ...j, ...patch } : j)));
  };

  return (
    <>
      <AppShell
        view={view}
        onViewChange={setView}
        activeJob={activeJob}
        onRefreshJobs={refreshJobs}
        loadingJobs={loadingJobs}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
                onRunPipeline={handleRunPipeline}
                onDeleteJob={handleJobDeleted}
              />
            )}
            {view === "pipeline" && activeJob && (
              <PipelineView
                job={activeJob}
                onGoToReview={() => setView("review")}
                onGoToQuality={() => setView("quality")}
                autoStart={autoStartPipeline}
                onAutoStartConsumed={() => setAutoStartPipeline(false)}
                onJobStatus={handleJobStatus}
              />
            )}
            {view === "pipeline" && !activeJob && (
              <EmptyState
                message="Create or select a job to view the live pipeline."
                action={() => setView("jobs")}
                actionLabel="Go to Jobs"
              />
            )}
            {view === "units" && activeJob && <UnitsView job={activeJob} />}
            {view === "units" && !activeJob && (
              <EmptyState
                message="Select a job to view annotated units."
                action={() => setView("jobs")}
                actionLabel="Go to Jobs"
              />
            )}
            {view === "review" && activeJob && <ReviewView job={activeJob} />}
            {view === "review" && !activeJob && (
              <EmptyState message="Select a job to review." action={() => setView("jobs")} actionLabel="Go to Jobs" />
            )}
            {view === "honeypot" && activeJob && <HoneypotView job={activeJob} />}
            {view === "honeypot" && !activeJob && (
              <EmptyState
                message="Select a job to inspect honeypots."
                action={() => setView("jobs")}
                actionLabel="Go to Jobs"
              />
            )}
            {view === "quality" && activeJob && <QualityView job={activeJob} />}
            {view === "quality" && !activeJob && (
              <EmptyState
                message="Select a job to view quality."
                action={() => setView("jobs")}
                actionLabel="Go to Jobs"
              />
            )}
            {view === "compare" && <CompareView />}
            {view === "insights" && <InsightsView />}
            {view === "taxonomy" && <TaxonomyView />}
            {view === "search" && (
              <SearchView
                onOpenResult={(jobId) => {
                  setActiveJobId(jobId);
                  setView("units");
                }}
              />
            )}
            {view === "activity" && <ActivityView />}
            {view === "architecture" && <ArchitectureView />}
            {view === "export" && activeJob && <ExportView job={activeJob} />}
            {view === "export" && !activeJob && (
              <EmptyState message="Select a job to export." action={() => setView("jobs")} actionLabel="Go to Jobs" />
            )}
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onViewChange={setView} />
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <OnboardingTour />
    </>
  );
}

function EmptyState({
  message,
  action,
  actionLabel,
}: {
  message: string;
  action: () => void;
  actionLabel: string;
}) {
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
