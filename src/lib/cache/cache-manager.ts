/**
 * Cache Manager for application-level caching
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { redisClient } from './redis-client';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

export class CacheManager {
  private static instance: CacheManager;
  private defaultTTL = 3600; // 1 hour
  private hitCount = 0;
  private missCount = 0;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string, prefix?: string): string {
    const basePrefix = prefix || 'shifteasy';
    return `${basePrefix}:${key}`;
  }

  /**
   * Cache schedule data
   */
  async cacheSchedule(
    tenantId: string,
    scheduleId: string,
    data: any,
    ttl: number = 7200 // 2 hours
  ): Promise<boolean> {
    const key = this.generateKey(`schedule:${tenantId}:${scheduleId}`, 'schedule');
    const value = JSON.stringify(data);
    return await redisClient.set(key, value, ttl);
  }

  /**
   * Get cached schedule
   */
  async getCachedSchedule(tenantId: string, scheduleId: string): Promise<any | null> {
    const key = this.generateKey(`schedule:${tenantId}:${scheduleId}`, 'schedule');
    const cached = await redisClient.get(key);

    if (cached) {
      this.hitCount++;
      return JSON.parse(cached);
    }

    this.missCount++;
    return null;
  }

  /**
   * Cache session data
   */
  async cacheSession(
    sessionId: string,
    data: any,
    ttl: number = 86400 // 24 hours
  ): Promise<boolean> {
    const key = this.generateKey(`session:${sessionId}`, 'session');
    const value = JSON.stringify(data);
    return await redisClient.set(key, value, ttl);
  }

  /**
   * Get cached session
   */
  async getCachedSession(sessionId: string): Promise<any | null> {
    const key = this.generateKey(`session:${sessionId}`, 'session');
    const cached = await redisClient.get(key);

    if (cached) {
      this.hitCount++;
      return JSON.parse(cached);
    }

    this.missCount++;
    return null;
  }

  /**
   * Cache computation result
   */
  async cacheComputation(
    computationKey: string,
    result: any,
    ttl: number = 3600 // 1 hour
  ): Promise<boolean> {
    const key = this.generateKey(`computation:${computationKey}`, 'compute');
    const value = JSON.stringify({
      result,
      timestamp: Date.now(),
    });
    return await redisClient.set(key, value, ttl);
  }

  /**
   * Get cached computation
   */
  async getCachedComputation(computationKey: string): Promise<any | null> {
    const key = this.generateKey(`computation:${computationKey}`, 'compute');
    const cached = await redisClient.get(key);

    if (cached) {
      this.hitCount++;
      const data = JSON.parse(cached);
      return data.result;
    }

    this.missCount++;
    return null;
  }

  /**
   * Cache API response
   */
  async cacheApiResponse(
    endpoint: string,
    params: any,
    response: any,
    ttl: number = 300 // 5 minutes
  ): Promise<boolean> {
    const paramKey = JSON.stringify(params);
    const key = this.generateKey(`api:${endpoint}:${Buffer.from(paramKey).toString('base64')}`, 'api');
    const value = JSON.stringify({
      response,
      timestamp: Date.now(),
    });
    return await redisClient.set(key, value, ttl);
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(endpoint: string, params: any): Promise<any | null> {
    const paramKey = JSON.stringify(params);
    const key = this.generateKey(`api:${endpoint}:${Buffer.from(paramKey).toString('base64')}`, 'api');
    const cached = await redisClient.get(key);

    if (cached) {
      this.hitCount++;
      const data = JSON.parse(cached);
      return data.response;
    }

    this.missCount++;
    return null;
  }

  /**
   * Cache user preferences
   */
  async cacheUserPreferences(
    userId: string,
    preferences: any,
    ttl: number = 604800 // 7 days
  ): Promise<boolean> {
    const key = this.generateKey(`user:${userId}:preferences`, 'user');
    const value = JSON.stringify(preferences);
    return await redisClient.set(key, value, ttl);
  }

  /**
   * Get cached user preferences
   */
  async getCachedUserPreferences(userId: string): Promise<any | null> {
    const key = this.generateKey(`user:${userId}:preferences`, 'user');
    const cached = await redisClient.get(key);

    if (cached) {
      this.hitCount++;
      return JSON.parse(cached);
    }

    this.missCount++;
    return null;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const keys = await redisClient.keys(`*${pattern}*`);
    if (keys.length > 0) {
      return await redisClient.del(keys);
    }
    return 0;
  }

  /**
   * Invalidate schedule cache
   */
  async invalidateSchedule(tenantId: string, scheduleId?: string): Promise<number> {
    if (scheduleId) {
      const key = this.generateKey(`schedule:${tenantId}:${scheduleId}`, 'schedule');
      return await redisClient.del(key);
    }
    return await this.invalidateByPattern(`schedule:${tenantId}`);
  }

  /**
   * Invalidate session cache
   */
  async invalidateSession(sessionId: string): Promise<number> {
    const key = this.generateKey(`session:${sessionId}`, 'session');
    return await redisClient.del(key);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(data: { key: string; value: any; ttl?: number }[]): Promise<void> {
    const promises = data.map(item => {
      const key = this.generateKey(item.key);
      const value = JSON.stringify(item.value);
      return redisClient.set(key, value, item.ttl || this.defaultTTL);
    });

    await Promise.all(promises);
    console.log(`Warmed up cache with ${data.length} items`);
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    hits: number;
    misses: number;
    hitRate: number;
    isConnected: boolean;
  } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;

    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: parseFloat(hitRate.toFixed(2)),
      isConnected: redisClient.isReady(),
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    await redisClient.flushall();
    this.resetStatistics();
  }

  /**
   * Batch get multiple keys
   */
  async batchGet(keys: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    const promises = keys.map(async (key) => {
      const fullKey = this.generateKey(key);
      const value = await redisClient.get(fullKey);
      if (value) {
        try {
          results.set(key, JSON.parse(value));
          this.hitCount++;
        } catch {
          results.set(key, value);
        }
      } else {
        this.missCount++;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Batch set multiple keys
   */
  async batchSet(items: { key: string; value: any; ttl?: number }[]): Promise<boolean[]> {
    const promises = items.map(item => {
      const fullKey = this.generateKey(item.key);
      const value = JSON.stringify(item.value);
      return redisClient.set(fullKey, value, item.ttl || this.defaultTTL);
    });

    return await Promise.all(promises);
  }

  /**
   * Implement cache-aside pattern
   */
  async cacheAside<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const fullKey = this.generateKey(key, options.prefix);

    // Try to get from cache
    const cached = await redisClient.get(fullKey);
    if (cached) {
      this.hitCount++;
      try {
        return JSON.parse(cached);
      } catch {
        return cached as T;
      }
    }

    // Cache miss - fetch from source
    this.missCount++;
    const data = await fetchFunction();

    // Store in cache
    const value = JSON.stringify(data);
    await redisClient.set(fullKey, value, options.ttl || this.defaultTTL);

    return data;
  }
}

export const cacheManager = CacheManager.getInstance();