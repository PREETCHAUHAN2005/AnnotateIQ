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
  Share2,
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
    id: "transaction_risk",
    name: "TransactionRiskAgent",
    icon: Gauge,
    tone: "emerald",
    samples: 1,
    temperature: 0,
    owns: ["transaction_risk", "evidence"],
    description: "Scores amount, time-of-day, payment method, and history. Does not judge device or merchant context.",
    promptSnippet: `You are the Transaction Risk Analyst for payment events.
Judge amount, time-of-day, payment method, and history only.
- "transaction_risk": LOW | MEDIUM | HIGH | CRITICAL
- "evidence": array of {feature, observation, impact: low|medium|high}`,
  },
  {
    id: "behavioral",
    name: "BehavioralAgent",
    icon: Activity,
    tone: "teal",
    samples: 1,
    temperature: 0,
    owns: ["behavior_anomaly", "behavioral_pattern", "evidence"],
    description: "Looks at velocity, account age, failed attempts, and refunds. Does not score the device graph.",
    promptSnippet: `You are the Behavioral Analyst for payment events.
Look at velocity, account age, failed attempts, refunds.
- "behavior_anomaly": boolean
- "behavioral_pattern": NONE | VELOCITY_ANOMALY | NEW_ACCOUNT_BURST | REPEAT_FAILURE | DORMANT_WAKE`,
  },
  {
    id: "device_network",
    name: "DeviceNetworkAgent",
    icon: Cpu,
    tone: "violet",
    samples: 1,
    temperature: 0,
    owns: ["device_risk", "evidence"],
    description: "Scores device reuse and IP / billing / shipping mismatch. Does not set the final risk label.",
    promptSnippet: `You are the Device & Network Analyst.
Look at device reuse, IP/billing/shipping mismatch, unusual device type.
- "device_risk": LOW | MEDIUM | HIGH | CRITICAL`,
  },
  {
    id: "merchant_order",
    name: "MerchantOrderAgent",
    icon: Layers,
    tone: "amber",
    samples: 1,
    temperature: 0,
    owns: ["merchant_context_risk", "evidence"],
    description: "Scores product category, order vs amount, refunds, and chargeback history.",
    promptSnippet: `You are the Merchant / Order Context Analyst.
Look at product category, order value vs amount, refunds, chargebacks.
- "merchant_context_risk": LOW | MEDIUM | HIGH | CRITICAL`,
  },
  {
    id: "fraud_reasoning",
    name: "FraudReasoningAgent",
    icon: Code2,
    tone: "emerald",
    samples: 3,
    temperature: 0.7,
    owns: ["risk_label", "recommended_action", "fraud_probability", "risk_factors", "explanation"],
    description: "Combines specialist signals into a proposed label and action. Sampled k=3 so specialists can disagree.",
    promptSnippet: `You are the Fraud Reasoning Agent. Combine specialist signals. Do not invent raw fields.
- "risk_label": LOW | MEDIUM | HIGH | CRITICAL
- "recommended_action": ALLOW | REVIEW | STEP_UP_VERIFICATION | HOLD | REJECT
- "explanation": 1-3 sentences citing event features`,
  },
  {
    id: "adjudicator",
    name: "AdjudicatorAgent",
    icon: ShieldCheck,
    tone: "rose",
    samples: 1,
    temperature: 0,
    owns: ["passed", "consensus", "final_label", "disagreement_reason"],
    description: "Judges only. Marks AGREED or DISPUTED. Never invents a new transaction.",
    promptSnippet: `You are the Adjudicator. Judge only. Never invent a new transaction.
If specialists include both LOW and HIGH/CRITICAL, consensus MUST be DISPUTED.
Return {"passed":true,"failures":[],"consensus":"AGREED","final_label":"HIGH",...}`,
  },
  {
    id: "ring_analyst",
    name: "RingAnalyst",
    icon: Share2,
    tone: "violet",
    samples: 1,
    temperature: 0,
    owns: ["network_risk", "relationship_confidence", "explanation"],
    description:
      "Judges a precomputed job-scoped entity graph. Does not invent edges or a cluster id. The graph owns risk_cluster_id, shared_entities, cluster_size, and member ids.",
    promptSnippet: `You are the Ring Analyst. Judge a precomputed job-scoped entity graph. Never invent edges or a new cluster id.
- "network_risk": LOW | MEDIUM | HIGH | CRITICAL
- "relationship_confidence": 0..1
- "explanation": 1-2 sentences citing shared_entities already in the packet`,
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
          Seven agents: four specialists, fraud reasoning, an adjudicator, and a job-scoped ring layer. The graph is deterministic — RingAnalyst judges it, and does not invent edges.
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
              { n: 4, text: "Exactly one loop: adjudicator → retry" },
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
          <CardDescription>Specialists → fraud reasoning → adjudicator → ring analyst → route</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-stretch gap-3">
            {/* Input */}
            <FlowNode label="Event Input" sub="1 payment event" tone="muted" icon={Layers} />
            <FlowArrow />
            {/* Fan-out cluster */}
            <div className="flex-1">
              <div className="text-xs text-muted-foreground text-center mb-2 font-semibold uppercase tracking-wider">Fan-out (parallel)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
                Closed vocabularies live in the <strong>system prompt</strong>. The user turn is the payment event plus derived signals. Synthetic or public-shaped data only.
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
