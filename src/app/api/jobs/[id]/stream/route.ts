import { NextRequest } from "next/server";
import { bus } from "@/lib/events";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/[id]/stream — Server-Sent Events stream of pipeline progress.
// Replays current state on connect so a refresh doesn't lose context.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      // ---- snapshot on connect ----
      const job = await db.job.findUnique({ where: { id } });
      if (job) send({ type: "job:status", jobId: id, ts: Date.now(), data: { status: job.status, unitCount: job.unitCount, autoCount: job.autoCount, humanCount: job.humanCount } });

      const units = await db.unit.findMany({
        where: { jobId: id },
        orderBy: { seq: "asc" },
        include: { final: true, _count: { select: { drafts: true } } },
      });
      send({
        type: "snapshot",
        jobId: id,
        ts: Date.now(),
        data: {
          units: units.map((u) => ({
            id: u.id,
            seq: u.seq,
            status: u.status,
            attempt: u.attempt,
            isHoneypot: u.isHoneypot,
            draftCount: u._count.drafts,
            route: u.final?.route ?? null,
            confidence: u.final?.confidence ?? null,
          })),
        },
      });

      // ---- live subscription ----
      const unsub = bus.subscribe(id, (evt) => {
        try {
          send(evt);
        } catch {
          // controller may be closed
        }
      });

      // heartbeat every 15s keeps the connection alive through proxies
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          /* noop */
        }
      }, 15000);

      // detect client disconnect
      const cleanup = () => {
        unsub();
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      req.signal.addEventListener("abort", cleanup);

      // keep stream open
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
