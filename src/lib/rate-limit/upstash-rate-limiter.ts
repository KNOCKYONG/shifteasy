/**
 * Upstash Rate Limiting System
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export class UpstashRateLimiter {
  private static instance: UpstashRateLimiter;
  private redis: Redis | null = null;
  private limiters: Map<string, Ratelimit> = new Map();

  private constructor() {
    this.initializeRedis();
    if (this.redis) {
      this.initializeLimiters();
    }
  }

  static getInstance(): UpstashRateLimiter {
    if (!UpstashRateLimiter.instance) {
      UpstashRateLimiter.instance = new UpstashRateLimiter();
    }
    return UpstashRateLimiter.instance;
  }

  private initializeRedis(): void {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      console.warn('Upstash Redis credentials not found, rate limiting disabled');
    }
  }

  private initializeLimiters(): void {
    if (!this.redis) return;

    // API rate limiter - sliding window
    this.limiters.set('api', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'rate_limit:api',
    }));

    // Auth rate limiter - token bucket (stricter)
    this.limiters.set('auth', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.tokenBucket(5, '1 m', 5),
      prefix: 'rate_limit:auth',
    }));

    // Report generation rate limiter - fixed window
    this.limiters.set('report', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.fixedWindow(10, '1 h'),
      prefix: 'rate_limit:report',
    }));

    // DDoS protection - sliding window
    this.limiters.set('ddos', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(1000, '1 s'),
      prefix: 'rate_limit:ddos',
    }));

    // Tenant-specific limiters with different tiers
    this.limiters.set('tenant:free', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rate_limit:tenant:free',
    }));

    this.limiters.set('tenant:basic', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'rate_limit:tenant:basic',
    }));

    this.limiters.set('tenant:premium', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(300, '1 m'),
      prefix: 'rate_limit:tenant:premium',
    }));

    this.limiters.set('tenant:enterprise', new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(1000, '1 m'),
      prefix: 'rate_limit:tenant:enterprise',
    }));
  }

  /**
   * Check rate limit
   */
  async checkLimit(
    limiterName: string,
    identifier: string
  ): Promise<{
    allowed: boolean;
    remaining: number;
    reset: number;
    limit: number;
  }> {
    const limiter = this.limiters.get(limiterName);

    if (!limiter) {
      // If no limiter, allow by default
      return {
        allowed: true,
        remaining: 999,
        reset: Date.now() + 60000,
        limit: 1000,
      };
    }

    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    return {
      allowed: success,
      remaining,
      reset,
      limit,
    };
  }

  /**
   * Check API rate limit
   */
  async checkApiLimit(identifier: string) {
    return this.checkLimit('api', identifier);
  }

  /**
   * Check auth rate limit
   */
  async checkAuthLimit(identifier: string) {
    return this.checkLimit('auth', identifier);
  }

  /**
   * Check report generation limit
   */
  async checkReportLimit(identifier: string) {
    return this.checkLimit('report', identifier);
  }

  /**
   * DDoS protection check
   */
  async checkDDoSProtection(ip: string) {
    return this.checkLimit('ddos', ip);
  }

  /**
   * Check tenant-specific rate limit
   */
  async checkTenantLimit(
    tenantId: string,
    tier: 'free' | 'basic' | 'premium' | 'enterprise' = 'free'
  ) {
    return this.checkLimit(`tenant:${tier}`, tenantId);
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(limiterName: string, identifier: string): Promise<void> {
    if (!this.redis) return;

    const limiter = this.limiters.get(limiterName);
    if (!limiter) return;

    // Get the prefix from the limiter
    const prefix = (limiter as any).prefix || `rate_limit:${limiterName}`;
    const key = `${prefix}:${identifier}`;

    await this.redis.del(key);
  }

  /**
   * Get remaining limit for an identifier
   */
  async getRemaining(
    limiterName: string,
    identifier: string
  ): Promise<number | null> {
    const limiter = this.limiters.get(limiterName);
    if (!limiter) return null;

    const result = await limiter.getRemaining(identifier);
    return result.remaining;
  }

  /**
   * Check if rate limiter is available
   */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * Get all configured limiters
   */
  getLimiters(): string[] {
    return Array.from(this.limiters.keys());
  }
}

export const upstashRateLimiter = UpstashRateLimiter.getInstance();