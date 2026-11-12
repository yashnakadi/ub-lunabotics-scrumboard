import "server-only";

/**
 * Small in-memory sliding-window limiter for login attempts.
 *
 * It protects a single server instance. If the app runs on several instances
 * (e.g. serverless), counts are per instance; for stronger guarantees back
 * this with a shared store such as Redis or a Postgres table. Supabase Auth
 * also applies its own per-IP rate limits to sign-in requests.
 */

interface Window {
  timestamps: number[];
}

const buckets = new Map<string, Window>();
const MAX_KEYS = 10_000;

export interface RateLimitRule {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest counted attempt expires. */
  retryAfterSeconds: number;
}

function prune(now: number, windowMs: number, bucket: Window) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

/** Checks every rule without recording an attempt. */
export function checkRateLimit(rules: RateLimitRule[]): RateLimitResult {
  const now = Date.now();
  let retryAfterMs = 0;
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (!bucket) continue;
    prune(now, rule.windowMs, bucket);
    if (bucket.timestamps.length >= rule.limit) {
      retryAfterMs = Math.max(retryAfterMs, rule.windowMs - (now - bucket.timestamps[0]));
    }
  }
  return { allowed: retryAfterMs === 0, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

/** Records one attempt against every rule's key. */
export function recordAttempt(rules: RateLimitRule[]): void {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    // Drop the oldest entries so memory stays bounded under abuse.
    for (const key of [...buckets.keys()].slice(0, buckets.size - MAX_KEYS / 2)) buckets.delete(key);
  }
  for (const rule of rules) {
    const bucket = buckets.get(rule.key) ?? { timestamps: [] };
    prune(now, rule.windowMs, bucket);
    bucket.timestamps.push(now);
    buckets.set(rule.key, bucket);
  }
}

/** Clears the counters for these keys (after a successful login). */
export function resetRateLimit(keys: string[]): void {
  for (const key of keys) buckets.delete(key);
}
