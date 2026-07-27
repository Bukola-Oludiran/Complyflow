/**
 * Simple token-bucket rate limiter keyed by a string identifier.
 *
 * Each bucket refills at `tokensPerSecond` up to a `burst` ceiling.
 * Rejects with `retryAfterMs` indicating how long to wait before retrying.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** How long (milliseconds) to wait before retrying, if not allowed */
  retryAfterMs?: number;
}

export interface RateLimiterOptions {
  tokensPerSecond: number;
  burst: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly tokensPerSecond: number;
  private readonly burst: number;

  constructor(options: RateLimiterOptions) {
    this.tokensPerSecond = options.tokensPerSecond;
    this.burst = options.burst;
  }

  /**
   * Try to consume `cost` tokens from the bucket for `key`.
   * Refills the bucket based on elapsed time since last check.
   */
  tryConsume(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.burst, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsedSec = (now - bucket.lastRefill) / 1000;
    const refill = elapsedSec * this.tokensPerSecond;
    bucket.tokens = Math.min(this.burst, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true };
    }

    const deficit = cost - bucket.tokens;
    const retryAfterMs = Math.ceil((deficit / this.tokensPerSecond) * 1000);
    return { allowed: false, retryAfterMs };
  }

  /** Remove a key's bucket (e.g., when a tenant is deleted) */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Remove all buckets */
  resetAll(): void {
    this.buckets.clear();
  }
}
