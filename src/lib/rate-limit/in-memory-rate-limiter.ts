/**
 * Lightweight in-memory rate limiter for Node runtimes.
 *
 * This replaces the third-party rate-limiter-flexible package, which broke the
 * Vercel build by exposing `.d.ts` files to Webpack. We only require an
 * in-process limiter for non-Upstash environments, so a purpose-built,
 * dependency-free implementation keeps the build stable.
 */

export interface RateLimiterOptions {
  keyPrefix: string;
  points: number;
  duration: number; // seconds
  blockDuration?: number; // seconds
}

export interface RateLimiterState {
  consumedPoints: number;
  remainingPoints: number;
  msBeforeNext: number;
  isFirstInDuration: boolean;
}

export class RateLimitExceededError extends Error {
  remainingPoints: number;
  msBeforeNext: number;

  constructor(message: string, remainingPoints: number, msBeforeNext: number) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.remainingPoints = remainingPoints;
    this.msBeforeNext = msBeforeNext;
  }
}

type Entry = {
  consumed: number;
  resetAt: number;
  blockedUntil?: number;
};

export class InMemoryRateLimiter {
  private readonly keyPrefix: string;

  private readonly points: number;

  private readonly durationMs: number;

  private readonly blockDurationMs: number;

  private readonly store = new Map<string, Entry>();

  constructor(options: RateLimiterOptions) {
    this.keyPrefix = options.keyPrefix;
    this.points = options.points;
    this.durationMs = Math.max(options.duration, 0) * 1000;
    this.blockDurationMs = Math.max(options.blockDuration ?? 0, 0) * 1000;
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  private getEntry(fullKey: string, now: number): Entry {
    const entry = this.store.get(fullKey);
    if (!entry || entry.resetAt <= now) {
      const fresh: Entry = {
        consumed: 0,
        resetAt: now + this.durationMs,
      };
      this.store.set(fullKey, fresh);
      return fresh;
    }
    return entry;
  }

  async consume(key: string, points: number = 1): Promise<RateLimiterState> {
    const now = Date.now();
    const storeKey = this.fullKey(key);
    const entry = this.getEntry(storeKey, now);

    // Respect active block if set.
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const msBeforeNext = entry.blockedUntil - now;
      throw new RateLimitExceededError(
        'Too many requests',
        0,
        msBeforeNext
      );
    }

    const newConsumed = entry.consumed + points;
    const remaining = Math.max(this.points - newConsumed, 0);

    if (newConsumed > this.points) {
      const blockUntil = this.blockDurationMs
        ? now + this.blockDurationMs
        : entry.resetAt;
      const msBeforeNext = Math.max(blockUntil - now, 0);

      if (this.blockDurationMs) {
        entry.blockedUntil = blockUntil;
      }

      entry.consumed = newConsumed;
      this.store.set(storeKey, entry);

      throw new RateLimitExceededError(
        'Too many requests',
        Math.max(remaining, 0),
        msBeforeNext
      );
    }

    entry.consumed = newConsumed;
    this.store.set(storeKey, entry);

    return {
      consumedPoints: newConsumed,
      remainingPoints: remaining,
      msBeforeNext: Math.max(entry.resetAt - now, 0),
      isFirstInDuration: newConsumed === points,
    };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.fullKey(key));
  }

  clear(): void {
    this.store.clear();
  }

  async get(key: string): Promise<RateLimiterState | null> {
    const now = Date.now();
    const entry = this.store.get(this.fullKey(key));
    if (!entry) return null;
    if (entry.resetAt <= now) {
      this.store.delete(this.fullKey(key));
      return null;
    }

    return {
      consumedPoints: entry.consumed,
      remainingPoints: Math.max(this.points - entry.consumed, 0),
      msBeforeNext: Math.max(entry.resetAt - now, 0),
      isFirstInDuration: entry.consumed === 0,
    };
  }

  getPoints(): number {
    return this.points;
  }

  getDurationSeconds(): number {
    return this.durationMs / 1000;
  }
}
