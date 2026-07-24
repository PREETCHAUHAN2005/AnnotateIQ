"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu,
  Layers,
  Gauge,
  ShieldCheck,
  Activity,
  ArrowRight,
  ArrowDown,
  GitBranch,
  Sparkles,
  Thermometer,
  Hash,
  Code2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AgentInfo = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "teal" | "violet" | "amber" | "rose";
  samples: number;
  temperature: number;
  owns: string[];
  description: string;
  promptSnippet: string;
};

const AGENTS: AgentInfo[] = [
  {
    id: "taxonomy",
    name: "TaxonomyAgent",
    icon: Layers,
    tone: "emerald",
    samples: 3,
    temperature: 0.7,
    owns: ["chapter", "concepts"],
    description: "Classifies the question into one of 29 NCERT chapters and extracts 1-4 key concepts.",
    promptSnippet: `You are the TaxonomyAgent. Given one physics question, choose:
- "chapter": exactly one chapter from the list above.
- "concepts": 1 to 4 short concept phrases actually present in the stem.`,
  },
  {
    id: "difficulty",
    name: "DifficultyAgent",
    icon: Gauge,
    tone: "teal",
    samples: 3,
    temperature: 0.7,
    owns: ["difficulty", "bloom", "difficulty_rationale"],
    description: "Assesses difficulty (easy/medium/hard), Bloom level, and grounds the rationale by quoting the stem.",
    promptSnippet: `You are the DifficultyAgent for JEE Physics questions.
Choose:
- "difficulty": "easy" | "medium" | "hard"
- "bloom": "remember" | "understand" | "apply" | "analyze"
- "difficulty_rationale": one sentence that MUST quote a phrase copied verbatim from the stem.`,
  },
  {
    id: "math",
    name: "MathAgent",
    icon: Code2,
    tone: "violet",
    samples: 1,
    temperature: 0,
    owns: ["latex", "has_equation"],
    description: "Extracts all mathematical expressions as LaTeX and flags whether the question contains equations.",
    promptSnippet: `You are the MathAgent for JEE Physics questions.
Extract every mathematical expression/formula present in the question as LaTeX strings.
- "latex": array of LaTeX strings (empty if none).
- "has_equation": true if the question contains any equation or formula, else false.`,
  },
  {
    id: "language",
    name: "LanguageAgent",
    icon: Activity,
    tone: "amber",
    samples: 1,
    temperature: 0,
    owns: ["language", "code_mix_ratio"],
    description: "Detects language (en/hi/hinglish) and computes the code-mix ratio of non-English tokens.",
    promptSnippet: `You are the LanguageAgent for JEE Physics questions.
Classify the language of the question:
- "language": "en" | "hi" | "hinglish"
- "code_mix_ratio": float 0.0 to 1.0 — fraction of non-English tokens.`,
  },
  {
    id: "critic",
    name: "CriticAgent",
    icon: ShieldCheck,
    tone: "rose",
    samples: 1,
    temperature: 0,
    owns: ["passed", "failures"],
    description: "Validates the merged annotation against a 4-point rubric. Never rewrites labels — only judges.",
    promptSnippet: `You are the Critic. Validate against EXACTLY these four checks:
1. "chapter" is one of the valid NCERT chapters.
2. Every string in "latex" parses as valid LaTeX.
3. "difficulty_rationale" quotes text ACTUALLY present in the stem.
4. No "concepts" entry is unsupported by the stem.

Do NOT rewrite labels. Only judge.`,
  },
];

const toneClasses = {
  emerald: { border: "border-foreground/30", text: "text-foreground", bg: "bg-foreground/5", glow: "glow-emerald" },
  teal: { border: "border-foreground/20", text: "text-foreground/80", bg: "bg-foreground/5", glow: "" },
  violet: { border: "border-foreground/20", text: "text-foreground/70", bg: "bg-foreground/5", glow: "" },
  amber: { border: "border-foreground/20", text: "text-foreground/60", bg: "bg-foreground/5", glow: "glow-amber" },
  rose: { border: "border-rose-500/40", text: "text-rose-400", bg: "bg-rose-500/5", glow: "glow-rose" },
};

export function ArchitectureView() {
  const [selected, setSelected] = useState<AgentInfo | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Cpu className="h-6 w-6 text-primary" /> Agent Architecture
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Five stateless agents with disjoint field ownership. Merge is a plain dict spread — never an LLM call.
        </p>
      </div>

      {/* Architecture rules banner */}
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">The four load-bearing rules</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { n: 1, text: "Agents are unit-scoped & stateless" },
              { n: 2, text: "Disjoint Zod schema is the contract" },
              { n: 3, text: "DB is the state, graph is ephemeral" },
              { n: 4, text: "Exactly one loop: critic → retry" },
            ].map((r) => (
              <div key={r.n} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                <span className="text-xs font-bold text-primary font-mono shrink-0">{r.n}</span>
                <span className="text-xs text-foreground/80">{r.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline flow diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline data flow</CardTitle>
          <CardDescription>One unit flows through fan-out → merge → critic → route</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-stretch gap-3">
            {/* Input */}
            <FlowNode label="Unit Input" sub="1 question" tone="muted" icon={Layers} />
            <FlowArrow />
            {/* Fan-out cluster */}
            <div className="flex-1">
              <div className="text-xs text-muted-foreground text-center mb-2 font-semibold uppercase tracking-wider">Fan-out (parallel)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {AGENTS.map((agent) => {
                  const tc = toneClasses[agent.tone];
                  const Icon = agent.icon;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelected(agent)}
                      className={cn(
                        "rounded-lg border p-3 text-center transition-all card-hover",
                        tc.border, tc.bg, tc.text
                      )}
                    >
                      <Icon className={cn("h-5 w-5 mx-auto mb-1.5", tc.text)} />
                      <div className="text-xs font-semibold truncate">{agent.name}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                          <Hash className="h-2 w-2" />×{agent.samples}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                          <Thermometer className="h-2 w-2" />{agent.temperature}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <FlowArrow />
            {/* Merge */}
            <FlowNode label="Merge" sub="dict.update()" tone="teal" icon={GitBranch} />
            <FlowArrow />
            {/* Score + Route */}
            <FlowNode label="Score & Route" sub="≥0.85 → auto" tone="emerald" icon={Gauge} />
          </div>
        </CardContent>
      </Card>

      {/* Agent detail cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {AGENTS.map((agent) => {
          const tc = toneClasses[agent.tone];
          const Icon = agent.icon;
          return (
            <Card
              key={agent.id}
              className={cn("border cursor-pointer card-hover", tc.border)}
              onClick={() => setSelected(agent)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-lg p-2.5", tc.bg)}>
                    <Icon className={cn("h-5 w-5", tc.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{agent.name}</span>
                      <Badge variant="outline" className="text-[9px] gap-0.5">
                        <Hash className="h-2.5 w-2.5" />{agent.samples} sample{agent.samples > 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] gap-0.5">
                        <Thermometer className="h-2.5 w-2.5" />T={agent.temperature}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{agent.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] text-muted-foreground">owns:</span>
                      {agent.owns.map((f) => (
                        <code key={f} className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono", tc.bg, tc.text)}>
                          {f}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Prompt detail dialog */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <Card
            className="max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {(() => {
                    const tc = toneClasses[selected.tone];
                    const Icon = selected.icon;
                    return <Icon className={cn("h-5 w-5", tc.text)} />;
                  })()}
                  {selected.name}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)} className="h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Description</div>
                <p className="text-sm">{selected.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Samples (k)</div>
                  <div className="text-sm font-mono font-bold">{selected.samples}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Temperature</div>
                  <div className="text-sm font-mono font-bold">{selected.temperature}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Fields owned</div>
                  <div className="text-sm font-mono font-bold">{selected.owns.length}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Fields owned (disjoint contract)</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.owns.map((f) => (
                    <code key={f} className="text-xs px-2 py-1 rounded font-mono bg-primary/10 text-primary border border-primary/20">
                      {f}
                    </code>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">System prompt (excerpt)</div>
                <pre className="text-xs font-mono p-3 rounded-lg bg-muted/60 border border-border/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selected.promptSnippet}
                </pre>
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t border-border/60">
                The taxonomy is carried in the <strong>system prompt</strong> (cacheable across all units), the user turn carries only the question. This is the single biggest cost lever.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function FlowNode({
  label,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  sub: string;
  tone: "muted" | "teal" | "emerald";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tc = {
    muted: "border-border/60 text-muted-foreground bg-muted/30",
    teal: "border-foreground/20 text-foreground/80 bg-foreground/5",
    emerald: "border-foreground/30 text-foreground bg-foreground/5",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3 flex flex-col items-center text-center min-w-[100px]", tc)}>
      <Icon className="h-5 w-5 mb-1" />
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center">
      <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground" />
      <ArrowDown className="lg:hidden h-5 w-5 text-muted-foreground" />
    </div>
  );
}
