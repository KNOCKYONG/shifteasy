/**
 * Rate Limiting System
 */

import {
  InMemoryRateLimiter,
  RateLimitExceededError,
  RateLimiterOptions,
} from './in-memory-rate-limiter';
import { redisClient } from '../cache/redis-client';

export interface RateLimitConfig {
  points: number; // Number of requests
  duration: number; // Per duration in seconds
  blockDuration?: number; // Block duration in seconds when limit exceeded
  keyPrefix?: string;
}

export interface TenantQuota {
  tenantId: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  limits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    maxUsers: number;
    maxStorage: number; // in MB
    maxBandwidth: number; // in GB per month
  };
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limiters: Map<string, InMemoryRateLimiter> = new Map();
  private tenantQuotas: Map<string, TenantQuota> = new Map();
  private usageStats: Map<string, any> = new Map();

  // Default tier limits
  private tierLimits = {
    free: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      maxUsers: 10,
      maxStorage: 100, // MB
      maxBandwidth: 1, // GB
    },
    basic: {
      requestsPerMinute: 120,
      requestsPerHour: 3000,
      requestsPerDay: 30000,
      maxUsers: 50,
      maxStorage: 500,
      maxBandwidth: 5,
    },
    premium: {
      requestsPerMinute: 300,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
      maxUsers: 200,
      maxStorage: 2000,
      maxBandwidth: 20,
    },
    enterprise: {
      requestsPerMinute: 1000,
      requestsPerHour: 50000,
      requestsPerDay: 500000,
      maxUsers: -1, // unlimited
      maxStorage: 10000,
      maxBandwidth: 100,
    },
  };

  private constructor() {
    this.initializeDefaultLimiters();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Initialize default rate limiters
   */
  private initializeDefaultLimiters(): void {
    // API rate limiter (general)
    this.createLimiter('api', {
      points: 100,
      duration: 60, // per minute
      blockDuration: 60,
    });

    // Auth rate limiter (stricter)
    this.createLimiter('auth', {
      points: 5,
      duration: 60,
      blockDuration: 900, // 15 minutes
    });

    // Report generation rate limiter
    this.createLimiter('report', {
      points: 10,
      duration: 3600, // per hour
      blockDuration: 300,
    });

    // DDoS protection limiter
    this.createLimiter('ddos', {
      points: 1000,
      duration: 1,
      blockDuration: 10,
    });
  }

  /**
   * Create a rate limiter
   */
  private createLimiter(name: string, config: RateLimitConfig): void {
    const limiterConfig: RateLimiterOptions = {
      keyPrefix: config.keyPrefix || `rate_limit_${name}`,
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration,
    };

    this.limiters.set(name, new InMemoryRateLimiter(limiterConfig));
  }

  /**
   * Consume points for a key
   */
  async consume(
    limiterName: string,
    key: string,
    points: number = 1
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const limiter = this.limiters.get(limiterName);
    if (!limiter) {
      throw new Error(`Rate limiter '${limiterName}' not found`);
    }

    try {
      const result = await limiter.consume(key, points);

      // Track usage
      this.trackUsage(key, limiterName, points);

      return {
        allowed: true,
        remaining: result.remainingPoints,
        resetAt: new Date(Date.now() + result.msBeforeNext),
      };
    } catch (error: unknown) {
      if (error instanceof RateLimitExceededError) {
        return {
          allowed: false,
          remaining: error.remainingPoints,
          resetAt: new Date(Date.now() + error.msBeforeNext),
        };
      }
      throw error;
    }
  }

  /**
   * Check tenant quota
   */
  async checkTenantQuota(
    tenantId: string,
    resource: keyof TenantQuota['limits']
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    let quota = this.tenantQuotas.get(tenantId);

    if (!quota) {
      // Default to free tier
      quota = {
        tenantId,
        tier: 'free',
        limits: this.tierLimits.free,
      };
      this.tenantQuotas.set(tenantId, quota);
    }

    const limit = quota.limits[resource];
    const current = await this.getCurrentUsage(tenantId, resource);

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
    };
  }

  /**
   * Set tenant quota
   */
  setTenantQuota(tenantId: string, tier: TenantQuota['tier']): void {
    const quota: TenantQuota = {
      tenantId,
      tier,
      limits: this.tierLimits[tier],
    };
    this.tenantQuotas.set(tenantId, quota);
  }

  /**
   * Get current usage for a tenant
   */
  private async getCurrentUsage(
    tenantId: string,
    resource: keyof TenantQuota['limits']
  ): Promise<number> {
    const key = `usage:${tenantId}:${resource}`;
    const usage = this.usageStats.get(key) || 0;

    // For time-based limits, check Redis
    if (resource.includes('requests')) {
      try {
        const redisKey = `usage:${tenantId}:${resource}:${this.getCurrentPeriod(resource)}`;
        const redisUsage = await redisClient.get(redisKey);
        return redisUsage ? parseInt(redisUsage) : usage;
      } catch {
        return usage;
      }
    }

    return usage;
  }

  /**
   * Track usage
   */
  private async trackUsage(key: string, resource: string, points: number): Promise<void> {
    const usageKey = `usage:${key}:${resource}`;
    const current = this.usageStats.get(usageKey) || 0;
    this.usageStats.set(usageKey, current + points);

    // Also track in Redis for persistence
    try {
      const redisKey = `${usageKey}:${this.getCurrentPeriod(resource)}`;
      await redisClient.incr(redisKey);
      await redisClient.expire(redisKey, 86400); // Expire after 1 day
    } catch {
      // Silent fail - memory tracking is enough
    }
  }

  /**
   * Get current period for time-based tracking
   */
  private getCurrentPeriod(resource: string): string {
    const now = new Date();
    if (resource.includes('Minute')) {
      return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    } else if (resource.includes('Hour')) {
      return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    } else {
      return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    }
  }

  /**
   * Check API rate limit
   */
  async checkApiLimit(
    identifier: string,
    points: number = 1
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    return await this.consume('api', identifier, points);
  }

  /**
   * Check auth rate limit
   */
  async checkAuthLimit(
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    return await this.consume('auth', identifier, 1);
  }

  /**
   * Check report generation limit
   */
  async checkReportLimit(
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    return await this.consume('report', identifier, 1);
  }

  /**
   * DDoS protection check
   */
  async checkDDoSProtection(
    ip: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    return await this.consume('ddos', ip, 1);
  }

  /**
   * Reset rate limit for a key
   */
  async reset(limiterName: string, key: string): Promise<void> {
    const limiter = this.limiters.get(limiterName);
    if (limiter) {
      await limiter.delete(key);
    }
  }

  /**
   * Get rate limit status
   */
  async getStatus(
    limiterName: string,
    key: string
  ): Promise<{ points: number; remainingPoints: number; resetAt: Date } | null> {
    const limiter = this.limiters.get(limiterName);
    if (!limiter) return null;

    try {
      const result = await limiter.get(key);
      if (!result) return null;

      return {
        points: result.consumedPoints || 0,
        remainingPoints: result.remainingPoints,
        resetAt: new Date(Date.now() + result.msBeforeNext),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all tenant quotas
   */
  getTenantQuotas(): TenantQuota[] {
    return Array.from(this.tenantQuotas.values());
  }

  /**
   * Get usage statistics
   */
  getUsageStatistics(): {
    tenantUsage: Map<string, any>;
    limitersStatus: any[];
  } {
    const limitersStatus = Array.from(this.limiters.entries()).map(([name, limiter]) => ({
      name,
      config: {
        points: limiter.getPoints(),
        duration: limiter.getDurationSeconds(),
      },
    }));

    return {
      tenantUsage: this.usageStats,
      limitersStatus,
    };
  }

  /**
   * Clear all rate limits (for testing)
   */
  async clearAll(): Promise<void> {
    this.limiters.forEach((limiter) => limiter.clear());
    this.usageStats.clear();
  }
}

export const rateLimiter = RateLimiter.getInstance();
