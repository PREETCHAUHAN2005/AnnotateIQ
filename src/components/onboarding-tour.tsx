"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Play,
  GitBranch,
  Gauge,
  FlaskConical,
  Download,
  Keyboard,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Search,
  TrendingUp,
} from "lucide-react";

const TOUR_STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to AnnotateIQ",
    description: "A multi-agent system that annotates payment events with inspectable risk labels and recommended actions. Specialists, fraud reasoning, an adjudicator, and a job-scoped ring analyst produce the labels. Failure packs add reason + retry routing. Synthetic/public data only.",
    color: "text-primary",
  },
  {
    icon: Play,
    title: "Live Pipeline",
    description: "Watch four specialists run in parallel, then a job-scoped ring analyst, fraud reasoning (k=3), and an adjudicator. Failure jobs add two more specialists. DISPUTED or low-confidence events route to human review.",
    color: "text-foreground",
  },
  {
    icon: GitBranch,
    title: "Review Queue",
    description: "DISPUTED events and low-confidence units (conf < 0.85) route here. Inspect where agents disagreed, accept/edit/reject with keyboard shortcuts (A/E/R/J/K).",
    color: "text-foreground/60",
  },
  {
    icon: Gauge,
    title: "Quality Dashboard",
    description: "Every number is computed — never hardcoded. Fleiss' κ, honeypot accuracy, confidence distribution, agent latency, and hours saved vs manual baseline.",
    color: "text-foreground/80",
  },
  {
    icon: FlaskConical,
    title: "Honeypot Inspector",
    description: "The only externally verifiable quality number. Gold labels vs agent predictions, field by field. This matters more than anything else on the dashboard.",
    color: "text-rose-400",
  },
  {
    icon: TrendingUp,
    title: "Insights & Trends",
    description: "Cross-job analytics with cumulative growth charts, auto-accept rate trends, and distribution breakdowns across all your annotation jobs.",
    color: "text-foreground/70",
  },
  {
    icon: Search,
    title: "Global Search",
    description: "Search annotated events by transaction id, merchant, risk label, action, factors, or explanation.",
    color: "text-foreground/80",
  },
  {
    icon: Download,
    title: "Export",
    description: "Download your ML-ready dataset as JSONL, JSON, or CSV. Only rows where route='auto' OR reviewer accepted/edited are included.",
    color: "text-foreground",
  },
  {
    icon: Keyboard,
    title: "Keyboard Shortcuts",
    description: "Press ⌘K / Ctrl+K for the command palette, ? for shortcuts help, or g+key to jump between views (g+o = overview, g+p = pipeline, etc.).",
    color: "text-primary",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // show tour on first visit (localStorage flag) — use a microtask to avoid
    // setState-during-effect lint warning
    const t = setTimeout(() => {
      const seen = typeof window !== "undefined" && localStorage.getItem("aiq-tour-seen");
      if (!seen) {
        setOpen(true);
      }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    setStep(0);
    if (typeof window !== "undefined") {
      localStorage.setItem("aiq-tour-seen", "1");
    }
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Tour</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Icon + step indicator */}
          <div className="flex items-center justify-between">
            <div className={`rounded-xl p-3 bg-current/10 ${current.color}`}>
              <Icon className={`h-6 w-6 ${current.color}`} />
            </div>
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-lg font-bold">{current.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.description}</p>
          </div>

          {/* Progress text */}
          <div className="text-[10px] text-muted-foreground font-mono">
            Step {step + 1} of {TOUR_STEPS.length}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
              Skip tour
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={prev}>
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next} className="gap-1.5">
                {isLast ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Get started</>
                ) : (
                  <>Next <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
