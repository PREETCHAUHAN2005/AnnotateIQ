// Lazy-load the SDK so importing this module never evaluates the SDK at
// module-load time (which can crash the Turbopack dev process).
type ZaiClient = Awaited<ReturnType<typeof import("z-ai-web-dev-sdk").default.create>>;
let _zai: ZaiClient | null = null;

async function getClient(): Promise<ZaiClient> {
  if (!_zai) {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    _zai = await ZAI.create();
  }
  return _zai;
}

// Global concurrency gate: the LLM provider rate-limits aggressively.
// Allow only a few in-flight calls at a time across the whole process.
const LLM_CONCURRENCY = 3;
let _inflight = 0;
const _waiters: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (_inflight < LLM_CONCURRENCY) {
    _inflight++;
    return;
  }
  await new Promise<void>((resolve) => _waiters.push(resolve));
  _inflight++;
}

function release(): void {
  _inflight--;
  const next = _waiters.shift();
  if (next) next();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Low-level chat completion with global concurrency gate + retry/backoff on
 * rate-limit (429) and transient errors. z-ai-web-dev-sdk expects the system
 * prompt carried in an `assistant`-role message; we normalize to that here.
 */
export async function chat(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; thinking?: boolean } = {}
): Promise<{ content: string; latencyMs: number }> {
  const start = Date.now();
  await acquire();
  try {
    const MAX_RETRIES = 4;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const zai = await getClient();
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "assistant", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: opts.temperature,
          thinking: { type: opts.thinking ? "enabled" : "disabled" },
        } as Record<string, unknown>);
        const content = completion.choices[0]?.message?.content ?? "";
        return { content, latencyMs: Date.now() - start };
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        const is429 = msg.includes("429") || msg.includes("Too many requests");
        const isTransient = is429 || msg.includes("5") && msg.includes("status");
        if (isTransient && attempt < MAX_RETRIES - 1) {
          // exponential backoff: 1s, 2s, 4s, 8s + jitter
          const backoff = Math.min(8000, 1000 * Math.pow(2, attempt)) + Math.random() * 500;
          await sleep(backoff);
          continue;
        }
        throw e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("chat failed");
  } finally {
    release();
  }
}

/** Strip markdown fences and extract the first JSON object/array from text. */
export function extractJson<T = unknown>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[\[{]/);
  if (start === -1) throw new Error("No JSON found in response");
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
  }
  if (end === -1) throw new Error("Unterminated JSON in response");
  const slice = t.slice(start, end + 1);
  return JSON.parse(slice) as T;
}

/**
 * Structured completion: ask the model for JSON, parse, and validate against a
 * parser. On parse failure returns null (caller decides retry/fallback).
 */
export async function structuredComplete<T>(
  systemPrompt: string,
  userPrompt: string,
  parse: (raw: unknown) => T,
  opts: { temperature?: number } = {}
): Promise<{ value: T | null; raw: string; latencyMs: number }> {
  const { content, latencyMs } = await chat(systemPrompt, userPrompt, opts);
  try {
    const json = extractJson(content);
    return { value: parse(json), raw: content, latencyMs };
  } catch {
    return { value: null, raw: content, latencyMs };
  }
}
