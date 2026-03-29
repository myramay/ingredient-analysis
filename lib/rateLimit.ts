/**
 * lib/rateLimit.ts
 *
 * Sliding-window in-memory rate limiter.
 *
 * OWASP reference: API4:2023 Unrestricted Resource Consumption
 *
 * How it works:
 *   Each (key, window) maintains an array of request timestamps.
 *   On every call we drop timestamps older than `windowMs`, then check
 *   whether the count has hit `limit`.  If yes → deny.  If no → record and allow.
 *
 * Production note:
 *   In-memory state is per-process.  On a single server or in dev this is
 *   perfectly reliable.  On a multi-instance deployment (Vercel, k8s) each
 *   replica has its own counter, so the effective limit is `limit × replicas`.
 *   To enforce a global limit across replicas, swap the Map for an Upstash Redis
 *   client using the same interface (checkRateLimit stays the same).
 */

import type { NextRequest } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  /** Whether this request should be allowed. */
  allowed: boolean;
  /** How many more requests the caller may make in the current window. */
  remaining: number;
  /** Unix timestamp (seconds) when the current window resets. */
  resetAt: number;
  /** Seconds the caller should wait before retrying (only set when !allowed). */
  retryAfter: number;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const store = new Map<string, number[]>();

// Prune stale entries at most once per minute to prevent unbounded growth.
// Each warm serverless instance runs this independently — that's fine.
let lastPruneAt = 0;
function maybePrune(windowMs: number): void {
  const now = Date.now();
  if (now - lastPruneAt < 60_000) return;
  lastPruneAt = now;
  const cutoff = now - windowMs;
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}

// ─── Core check ──────────────────────────────────────────────────────────────

/**
 * Check and record a rate-limit hit for `key`.
 *
 * @param key      Unique identifier, e.g. `"analyze:203.0.113.1"`.
 * @param limit    Max requests allowed within `windowMs`.
 * @param windowMs Rolling window size in milliseconds.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  maybePrune(windowMs);

  const now = Date.now();
  const windowStart = now - windowMs;

  // Retrieve existing timestamps and discard anything outside the window
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    // Oldest timestamp in the window + windowMs = when the next slot opens
    const oldestTs = timestamps[0];
    const resetAt = Math.ceil((oldestTs + windowMs) / 1000);
    const retryAfter = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, resetAt, retryAfter };
  }

  // Record this request
  timestamps.push(now);
  store.set(key, timestamps);

  const remaining = limit - timestamps.length;
  const resetAt = Math.ceil((now + windowMs) / 1000);
  return { allowed: true, remaining, resetAt, retryAfter: 0 };
}

// ─── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extract the real client IP from the request.
 *
 * Trusts the `x-forwarded-for` header (set by Vercel, Nginx, Cloudflare, etc.)
 * and falls back to `x-real-ip`.  Returns `"unknown"` as a last resort — this
 * still works for rate-limiting: all "unknown" callers share one bucket.
 *
 * SECURITY: Only trust these headers when the app sits behind a trusted proxy.
 * If you ever move to a raw-socket deployment, remove the header fallback.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may be a comma-separated list; the leftmost entry is the
    // original client IP (rightmost entries are added by each proxy hop).
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// ─── Response helper ──────────────────────────────────────────────────────────

/**
 * Build the standard rate-limit headers to include on every response.
 * Follows the IETF draft for RateLimit headers (draft-ietf-httpapi-ratelimit-headers).
 */
export function rateLimitHeaders(
  result: RateLimitResult,
  limit: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  return headers;
}
