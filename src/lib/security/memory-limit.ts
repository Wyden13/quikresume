// src/lib/security/memory-limit.ts
// In-process fixed-window counter. Pure Node/edge-safe (no Firestore), so the proxy can use it for
// a per-IP burst limit and the durable limiter can use it as a fast path. Per instance only: on a
// serverless platform every instance keeps its own counts, which is why anything that must hold
// across instances goes through `lib/security/rate-limit.ts`.

interface Bucket { count: number; windowStart: number }

const MAX_KEYS = 20_000;
const buckets = new Map<string, Bucket>();

function evictIfNeeded(now: number, windowMs: number) {
    if (buckets.size < MAX_KEYS) return;
    for (const [k, b] of buckets) if (now - b.windowStart >= windowMs) buckets.delete(k);
    // Still full (a flood of distinct keys): drop the oldest inserted entries.
    if (buckets.size >= MAX_KEYS) {
        let n = Math.ceil(MAX_KEYS / 10);
        for (const k of buckets.keys()) { buckets.delete(k); if (--n <= 0) break; }
    }
}

export interface MemoryLimitResult { ok: boolean; count: number; remaining: number; retryAfterMs: number }

/** Counts one hit for `key` and reports whether it stays within `limit` per `windowMs`. */
export function memoryHit(key: string, limit: number, windowMs: number, now = Date.now()): MemoryLimitResult {
    let b = buckets.get(key);
    if (!b || now - b.windowStart >= windowMs) {
        evictIfNeeded(now, windowMs);
        b = { count: 0, windowStart: now };
        buckets.set(key, b);
    }
    b.count += 1;
    const retryAfterMs = Math.max(0, b.windowStart + windowMs - now);
    return { ok: b.count <= limit, count: b.count, remaining: Math.max(0, limit - b.count), retryAfterMs };
}

/** Reads without counting (used to mirror the durable limiter's verdict). */
export function memoryPeek(key: string, windowMs: number, now = Date.now()): Bucket | null {
    const b = buckets.get(key);
    return b && now - b.windowStart < windowMs ? b : null;
}

/** Overwrites the local mirror with what the durable store said. */
export function memorySet(key: string, count: number, windowStart: number) {
    buckets.set(key, { count, windowStart });
}
