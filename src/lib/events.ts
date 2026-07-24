import { EventEmitter } from "events";

// In-memory event bus for SSE streaming of pipeline progress.
// One channel per job. Single-process Next.js is sufficient for the demo.
type PipelineEvent = {
  type: string;
  jobId: string;
  ts: number;
  data: Record<string, unknown>;
};

class Bus extends EventEmitter {
  /** Publish a pipeline event for a job. */
  publish(jobId: string, type: string, data: Record<string, unknown>): boolean {
    const evt: PipelineEvent = { type, jobId, ts: Date.now(), data };
    // use the underlying EventEmitter emit, NOT our own method
    return super.emit(`job:${jobId}`, evt);
  }
  subscribe(jobId: string, listener: (evt: PipelineEvent) => void): () => void {
    const key = `job:${jobId}`;
    this.on(key, listener);
    return () => this.off(key, listener);
  }
}

export const bus = new Bus();
bus.setMaxListeners(100);

export type { PipelineEvent };
