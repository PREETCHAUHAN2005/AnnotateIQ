import { z } from "zod";

// ---- Agent output contracts (disjoint fields — merge is a plain spread) ----

export const TaxonomyOut = z.object({
  chapter: z.string(),
  concepts: z.array(z.string()).min(1).max(4),
});
export type TaxonomyOut = z.infer<typeof TaxonomyOut>;

export const DifficultyOut = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
  bloom: z.enum(["remember", "understand", "apply", "analyze"]),
  difficulty_rationale: z.string().min(1),
});
export type DifficultyOut = z.infer<typeof DifficultyOut>;

export const MathOut = z.object({
  latex: z.array(z.string()).default([]),
  has_equation: z.boolean(),
});
export type MathOut = z.infer<typeof MathOut>;

export const LanguageOut = z.object({
  language: z.enum(["en", "hi", "hinglish"]),
  code_mix_ratio: z.number().min(0).max(1),
});
export type LanguageOut = z.infer<typeof LanguageOut>;

export const CriticOut = z.object({
  passed: z.boolean(),
  failures: z.array(z.string()).default([]),
});
export type CriticOut = z.infer<typeof CriticOut>;

// ---- Merged final record written to `finals` ----
export const UnitAnnotation = z.object({
  unit_id: z.string(),
  stem: z.string(),
  options: z.array(z.string()).nullable().default(null),
  subject: z.literal("physics").default("physics"),
  chapter: z.string(),
  concepts: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
  bloom: z.enum(["remember", "understand", "apply", "analyze"]),
  difficulty_rationale: z.string(),
  latex: z.array(z.string()).default([]),
  has_equation: z.boolean().default(false),
  language: z.enum(["en", "hi", "hinglish"]).default("en"),
  code_mix_ratio: z.number().min(0).max(1).default(0),
  confidence: z.number(),
  agreement: z.number(),
  route: z.enum(["auto", "human"]),
});
export type UnitAnnotation = z.infer<typeof UnitAnnotation>;

import taxonomy from "@/lib/data/taxonomy.json";
export const CHAPTERS: string[] = taxonomy.chapters;

export function parseTaxonomy(raw: unknown): TaxonomyOut {
  return TaxonomyOut.parse(raw);
}
export function parseDifficulty(raw: unknown): DifficultyOut {
  return DifficultyOut.parse(raw);
}
export function parseMath(raw: unknown): MathOut {
  return MathOut.parse(raw);
}
export function parseLanguage(raw: unknown): LanguageOut {
  return LanguageOut.parse(raw);
}
export function parseCritic(raw: unknown): CriticOut {
  return CriticOut.parse(raw);
}
