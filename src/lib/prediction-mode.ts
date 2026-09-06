/** How the pipeline produces labels this process. */

export type PredictionMode = "deterministic_fallback" | "llm";

export function isSkipLlm(): boolean {
  return process.env.SKIP_LLM === "1";
}

export function predictionMode(): PredictionMode {
  return isSkipLlm() ? "deterministic_fallback" : "llm";
}

export function predictionModeLabel(): string {
  return isSkipLlm() ? "Deterministic fallback demo" : "LLM-backed";
}
