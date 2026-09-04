import {
  CanonicalPaymentEvent,
  DerivedSignals,
  type CanonicalPaymentEvent as Event,
  type DerivedSignals as Signals,
} from "@/lib/schemas";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Accept dummy/canonical events (and loose JSON). */
export function fromDummy(raw: unknown): Event {
  const r = (raw ?? {}) as Record<string, unknown>;
  const event = r.event && typeof r.event === "object" ? (r.event as Record<string, unknown>) : r;
  return CanonicalPaymentEvent.parse({
    transaction_id: str(event.transaction_id) ?? `TX_${Date.now()}`,
    merchant_id: str(event.merchant_id),
    customer_id: str(event.customer_id),
    timestamp: str(event.timestamp),
    amount: num(event.amount),
    payment_method: str(event.payment_method),
    device_type: str(event.device_type),
    device_id_hash: str(event.device_id_hash),
    ip_region: str(event.ip_region),
    billing_region: str(event.billing_region),
    shipping_region: str(event.shipping_region),
    previous_transaction_count: num(event.previous_transaction_count),
    failed_attempts_1h: num(event.failed_attempts_1h),
    refund_count_30d: num(event.refund_count_30d),
    chargeback_history: num(event.chargeback_history),
    account_age: num(event.account_age),
    order_value: num(event.order_value),
    product_category: str(event.product_category),
    payment_status: str(event.payment_status),
  });
}

/**
 * Map IEEE-CIS-like columns onto the canonical event.
 * Missing fields stay null. Does not require the full Kaggle dump.
 */
export function fromIeeeCis(row: unknown): Event {
  const r = (row ?? {}) as Record<string, unknown>;
  const id = str(r.TransactionID) ?? str(r.transaction_id) ?? `IEEE_${Date.now()}`;
  const amt = num(r.TransactionAmt) ?? num(r.amount);
  const device =
    str(r.DeviceType) ?? str(r.DeviceInfo) ?? str(r.id_30) ?? str(r.id_31);
  const pay = [str(r.card4), str(r.card6)].filter(Boolean).join("_") || str(r.payment_method);
  const billing = str(r.addr1) ?? str(r.billing_region);
  const ipish = str(r.id_14) ?? str(r.P_emaildomain) ?? str(r.ip_region);
  return CanonicalPaymentEvent.parse({
    transaction_id: String(id),
    merchant_id: str(r.ProductCD) ? `M_${r.ProductCD}` : str(r.merchant_id),
    customer_id: str(r.card1) ?? str(r.customer_id),
    timestamp: str(r.TransactionDT) ?? str(r.timestamp),
    amount: amt,
    payment_method: pay,
    device_type: device,
    device_id_hash: str(r.DeviceInfo) ?? str(r.device_id_hash),
    ip_region: ipish,
    billing_region: billing,
    shipping_region: str(r.addr2) ?? str(r.shipping_region) ?? billing,
    previous_transaction_count: num(r.previous_transaction_count),
    failed_attempts_1h: num(r.failed_attempts_1h),
    refund_count_30d: num(r.refund_count_30d),
    chargeback_history: num(r.chargeback_history),
    account_age: num(r.D1) ?? num(r.account_age),
    order_value: amt,
    product_category: str(r.ProductCD) ?? str(r.product_category),
    payment_status: str(r.payment_status) ?? "unknown",
  });
}

export function toCanonicalEvent(raw: unknown): Event {
  if (!raw || typeof raw !== "object") {
    return fromDummy({ transaction_id: `TX_${Date.now()}` });
  }
  const r = raw as Record<string, unknown>;
  if ("TransactionID" in r || "TransactionAmt" in r || "ProductCD" in r) {
    return fromIeeeCis(r);
  }
  return fromDummy(r);
}

export function computeDerivedSignals(
  event: Event,
  ctx?: { sameDeviceInJob?: number }
): Signals {
  const failed = event.failed_attempts_1h ?? 0;
  const prev = event.previous_transaction_count ?? 0;
  const age = event.account_age ?? 365;
  const amount = event.amount ?? 0;
  const order = event.order_value ?? amount;
  const refunds = event.refund_count_30d ?? 0;
  const cb = event.chargeback_history ?? 0;

  const velocity_score = Math.min(1, failed / 8 + (age < 7 && prev > 3 ? 0.35 : 0));
  const amount_anomaly =
    amount >= 50000 || (order > 0 && amount > order * 1.5) || (age < 14 && amount >= 20000);
  const geo_mismatch = Boolean(
    (event.ip_region && event.billing_region && event.ip_region !== event.billing_region) ||
      (event.billing_region &&
        event.shipping_region &&
        event.billing_region !== event.shipping_region)
  );
  const reuse = ctx?.sameDeviceInJob ?? 1;
  const device_reuse_score = Math.min(1, Math.max(0, (reuse - 1) / 3));
  const merchant_risk = Math.min(1, cb * 0.35 + refunds * 0.12);
  const customer_behavior_score = Math.min(
    1,
    failed / 6 + (age < 7 ? 0.4 : 0) + (prev === 0 ? 0.2 : 0)
  );

  return DerivedSignals.parse({
    velocity_score: Math.round(velocity_score * 100) / 100,
    amount_anomaly,
    geo_mismatch,
    device_reuse_score: Math.round(device_reuse_score * 100) / 100,
    merchant_risk: Math.round(merchant_risk * 100) / 100,
    customer_behavior_score: Math.round(customer_behavior_score * 100) / 100,
  });
}

export function eventSummary(event: Event): string {
  const amt = event.amount != null ? `₹${event.amount}` : "n/a";
  return `${event.transaction_id} · ${amt} · ${event.merchant_id ?? "merchant?"} · ${event.payment_method ?? "method?"}`;
}

export function parseUnitEvent(rawText: string, stem?: string | null): Event {
  const tryParse = (s: string) => {
    const cleaned = s.replace(/<critique>[\s\S]*?<\/critique>/g, "").trim();
    return toCanonicalEvent(JSON.parse(cleaned));
  };
  try {
    if (rawText.trim().startsWith("{")) return tryParse(rawText);
  } catch {
    /* fall through */
  }
  if (stem) {
    try {
      return tryParse(stem);
    } catch {
      /* fall through */
    }
  }
  return fromDummy({ transaction_id: "TX_UNKNOWN", payment_status: "unknown" });
}
