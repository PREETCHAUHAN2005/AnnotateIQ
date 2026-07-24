import { chat, structuredComplete } from "@/lib/llm";
import {
  CHAPTERS,
  parseCritic,
  parseDifficulty,
  parseLanguage,
  parseMath,
  parseTaxonomy,
  type CriticOut,
  type DifficultyOut,
  type LanguageOut,
  type MathOut,
  type TaxonomyOut,
} from "@/lib/schemas";

export type UnitInput = {
  unitId: string;
  stem: string;
  options: string[] | null;
};

// ---- System prompts carry the taxonomy (prompt-cacheable across units) ----

const TAXONOMY_BLOCK = `You annotate JEE (Indian engineering entrance) PHYSICS questions only.
The chapter MUST be one of these ${CHAPTERS.length} NCERT chapters (use the exact string):
${CHAPTERS.map((c) => `- ${c}`).join("\n")}
Return STRICT JSON only, no prose, no markdown fences.`;

// ============================ TaxonomyAgent ============================
// k=3 samples, temperature 0.7

export async function runTaxonomy(
  unit: UnitInput
): Promise<{ value: TaxonomyOut | null; raw: string; latencyMs: number }> {
  const sys = `${TAXONOMY_BLOCK}

You are the TaxonomyAgent. Given one physics question, choose:
- "chapter": exactly one chapter from the list above.
- "concepts": 1 to 4 short concept phrases actually present in the stem (lowercase, no chapter name).

Return JSON: {"chapter": "...", "concepts": ["...", "..."]}`;

  const user = `Question:\n${unit.stem}${
    unit.options ? `\nOptions: ${unit.options.join(", ")}` : ""
  }`;

  return structuredComplete(sys, user, parseTaxonomy, { temperature: 0.7 });
}

// ============================ DifficultyAgent ============================
// k=3 samples, temperature 0.7

export async function runDifficulty(
  unit: UnitInput
): Promise<{ value: DifficultyOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the DifficultyAgent for JEE Physics questions.
Choose:
- "difficulty": "easy" | "medium" | "hard"
- "bloom": "remember" | "understand" | "apply" | "analyze"
- "difficulty_rationale": one sentence that MUST quote a phrase copied verbatim from the question stem to ground the judgement.

Return STRICT JSON only: {"difficulty": "...", "bloom": "...", "difficulty_rationale": "..."}`;

  const user = `Question:\n${unit.stem}${
    unit.options ? `\nOptions: ${unit.options.join(", ")}` : ""
  }`;

  return structuredComplete(sys, user, parseDifficulty, { temperature: 0.7 });
}

// ============================ MathAgent ============================
// single sample, temperature 0

export async function runMath(
  unit: UnitInput
): Promise<{ value: MathOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the MathAgent for JEE Physics questions.
Extract every mathematical expression/formula present in the question as LaTeX strings.
- "latex": array of LaTeX strings (empty if none). Use standard LaTeX, e.g. "E = mc^2".
- "has_equation": true if the question contains any equation or formula, else false.

Return STRICT JSON only: {"latex": ["..."], "has_equation": true}`;

  const user = `Question:\n${unit.stem}${
    unit.options ? `\nOptions: ${unit.options.join(", ")}` : ""
  }`;

  return structuredComplete(sys, user, parseMath, { temperature: 0 });
}

// ============================ LanguageAgent ============================
// single sample, temperature 0

export async function runLanguage(
  unit: UnitInput
): Promise<{ value: LanguageOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the LanguageAgent for JEE Physics questions.
Classify the language of the question:
- "language": "en" (pure English) | "hi" (pure Hindi/Devanagari) | "hinglish" (mix of Hindi + English in Latin script)
- "code_mix_ratio": float 0.0 to 1.0 — fraction of non-English (Hindi/Hinglish) tokens. 0.0 = pure English, 1.0 = pure Hindi.

Return STRICT JSON only: {"language": "en", "code_mix_ratio": 0.0}`;

  const user = `Question:\n${unit.stem}${
    unit.options ? `\nOptions: ${unit.options.join(", ")}` : ""
  }`;

  return structuredComplete(sys, user, parseLanguage, { temperature: 0 });
}

// ============================ CriticAgent ============================
// single sample, temperature 0 — rubric validation only, never rewrites labels

export async function runCritic(
  unit: UnitInput,
  merged: {
    chapter: string;
    concepts: string[];
    latex: string[];
    difficulty_rationale: string;
  }
): Promise<{ value: CriticOut | null; raw: string; latencyMs: number }> {
  const sys = `You are the Critic for a JEE Physics annotation pipeline. Validate the annotation against EXACTLY these four checks:
1. "chapter" is one of the ${CHAPTERS.length} valid NCERT chapters.
2. Every string in "latex" parses as valid LaTeX (balanced braces, valid commands).
3. "difficulty_rationale" quotes text that is ACTUALLY present verbatim in the question stem.
4. No "concepts" entry is absent from or unsupported by the stem.

Valid chapters:
${CHAPTERS.map((c) => `- ${c}`).join("\n")}

Do NOT rewrite any labels. Only judge. Return STRICT JSON:
{"passed": true, "failures": []}
or
{"passed": false, "failures": ["check 3: rationale quote not found in stem", ...]}`;

  const user = `Question stem:
${unit.stem}
${unit.options ? `\nOptions: ${unit.options.join(", ")}` : ""}

Annotation to validate:
- chapter: ${merged.chapter}
- concepts: ${JSON.stringify(merged.concepts)}
- latex: ${JSON.stringify(merged.latex)}
- difficulty_rationale: ${merged.difficulty_rationale}`;

  return structuredComplete(sys, user, parseCritic, { temperature: 0 });
}

// Heuristic fallbacks — used when the LLM is rate-limited or unparseable.
// These analyse the question text deterministically so the pipeline never
// stalls and the demo always produces realistic, varied annotations.
import {
  heuristicDifficulty,
  heuristicLanguage,
  heuristicMath,
  heuristicTaxonomy,
} from "@/lib/heuristics";

export function fallbackTaxonomy(stem: string, sampleIdx = 0): TaxonomyOut {
  return heuristicTaxonomy(stem, sampleIdx);
}
export function fallbackDifficulty(stem: string, sampleIdx = 0): DifficultyOut {
  return heuristicDifficulty(stem, sampleIdx);
}
export function fallbackMath(stem: string): MathOut {
  return heuristicMath(stem);
}
export function fallbackLanguage(stem: string): LanguageOut {
  return heuristicLanguage(stem);
}
