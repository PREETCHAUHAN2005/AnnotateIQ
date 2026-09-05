import type { CanonicalPaymentEvent, RiskLevel } from "@/lib/schemas";

export type RingEvent = {
  unitId: string;
  seq: number;
  event: CanonicalPaymentEvent;
};

export type RingAssignment = {
  risk_cluster_id: string | null;
  network_risk: RiskLevel;
  relationship_confidence: number;
  shared_entities: string[];
  cluster_size: number;
  member_transaction_ids: string[];
};

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

function indexBy(events: RingEvent[], pick: (e: CanonicalPaymentEvent) => string | null | undefined) {
  const map = new Map<string, number[]>();
  events.forEach((e, i) => {
    const k = pick(e.event)?.trim();
    if (!k) return;
    const list = map.get(k) ?? [];
    list.push(i);
    map.set(k, list);
  });
  return map;
}

function topKey(counts: Map<string, number>): [string, number] | null {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0] ?? null;
}

function tally(values: Array<string | null | undefined>): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

export function emptyRing(transactionId?: string): RingAssignment {
  return {
    risk_cluster_id: null,
    network_risk: "LOW",
    relationship_confidence: 0,
    shared_entities: [],
    cluster_size: 1,
    member_transaction_ids: transactionId ? [transactionId] : [],
  };
}

/**
 * Job-scoped entity graph. Edges:
 * - same device_id_hash (strong)
 * - same customer_id (bridge so a customer's events stay together)
 *
 * A RING is emitted only when a component has ≥2 events AND ≥2 distinct customers.
 * Same-customer repeats (one person, one device) are not a ring.
 * IDs are stable: RING_DEV_{device_id_hash} when a shared device exists.
 */
export function buildJobRings(events: RingEvent[]): Map<string, RingAssignment> {
  const n = events.length;
  const out = new Map<string, RingAssignment>();
  if (n === 0) return out;

  const uf = new UnionFind(n);
  for (const idxs of indexBy(events, (e) => e.device_id_hash).values()) {
    for (let i = 1; i < idxs.length; i++) uf.union(idxs[0], idxs[i]);
  }
  for (const idxs of indexBy(events, (e) => e.customer_id).values()) {
    for (let i = 1; i < idxs.length; i++) uf.union(idxs[0], idxs[i]);
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const g = groups.get(root) ?? [];
    g.push(i);
    groups.set(root, g);
  }

  for (const members of groups.values()) {
    const evs = members.map((i) => events[i]);
    const customers = new Set(evs.map((e) => e.event.customer_id).filter((v): v is string => Boolean(v?.trim())));
    const isRing = members.length >= 2 && customers.size >= 2;

    if (!isRing) {
      for (const e of evs) out.set(e.unitId, emptyRing(e.event.transaction_id));
      continue;
    }

    const deviceCounts = tally(evs.map((e) => e.event.device_id_hash));
    const ipCounts = tally(evs.map((e) => e.event.ip_region));
    const topDev = topKey(deviceCounts);
    const topIp = topKey(ipCounts);

    const shared: string[] = [];
    if (topDev && topDev[1] >= 2) shared.push(`device:${topDev[0]}`);
    if (topIp && topIp[1] >= 2) shared.push(`ip_region:${topIp[0]}`);
    for (const c of [...customers].sort()) shared.push(`customer:${c}`);

    const clusterId = topDev && topDev[1] >= 2 ? `RING_DEV_${topDev[0]}` : `RING_SEQ_${Math.min(...evs.map((e) => e.seq))}`;

    let network_risk: RiskLevel = "MEDIUM";
    let conf = 0.8;
    if (topDev && topDev[1] >= 5) {
      network_risk = "CRITICAL";
      conf = 0.94;
    } else if (topDev && topDev[1] >= 3) {
      network_risk = "HIGH";
      conf = 0.9;
    }
    if (ipCounts.size >= 2) conf = Math.min(1, Math.round((conf + 0.04) * 100) / 100);

    const assignment: RingAssignment = {
      risk_cluster_id: clusterId,
      network_risk,
      relationship_confidence: conf,
      shared_entities: shared,
      cluster_size: members.length,
      member_transaction_ids: evs.map((e) => e.event.transaction_id),
    };
    for (const e of evs) out.set(e.unitId, assignment);
  }

  return out;
}
