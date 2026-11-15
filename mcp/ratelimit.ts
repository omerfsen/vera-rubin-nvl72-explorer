/**
 * Token-bucket rate limiter, one bucket per caller key. The spec requires
 * servers to rate limit tool invocations; a concurrency cap does not count.
 * Buckets live in memory, so on a serverless platform the limit is per
 * instance (see docs/mcp/security.md).
 */
export interface RateLimitOptions {
  /** Burst size: calls allowed at once. */
  capacity: number;
  /** Tokens added back per second. */
  refillPerSecond: number;
  /** Most keys kept; the oldest is dropped beyond this. */
  maxKeys?: number;
  /** Clock, for tests. */
  now?: () => number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(private readonly opts: RateLimitOptions) {
    this.maxKeys = opts.maxKeys ?? 10_000;
    this.now = opts.now ?? Date.now;
  }

  /** Takes one token for `key`. Returns 0 when allowed, else milliseconds until the next token. */
  take(key: string): number {
    const now = this.now();
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) this.buckets.delete(this.buckets.keys().next().value!);
      b = { tokens: this.opts.capacity, at: now };
    } else {
      this.buckets.delete(key);
      b.tokens = Math.min(this.opts.capacity, b.tokens + ((now - b.at) / 1000) * this.opts.refillPerSecond);
      b.at = now;
    }
    this.buckets.set(key, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return 0;
    }
    return Math.ceil(((1 - b.tokens) / this.opts.refillPerSecond) * 1000);
  }
}
