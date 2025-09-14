/**
 * Optimized Cache Manager with reduced Upstash commands
 */

import { optimizedRedisClient } from './optimized-redis-client';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

export class OptimizedCacheManager {
  private static instance: OptimizedCacheManager;
  private defaultTTL = 3600; // 1 hour

  // Longer TTLs to reduce refresh frequency
  private readonly TTL_CONFIG = {
    schedule: 14400,     // 4 hours (was 2 hours)
    session: 172800,     // 48 hours (was 24 hours)
    computation: 7200,   // 2 hours (was 1 hour)
    api: 600,           // 10 minutes (was 5 minutes)
    user: 1209600,      // 14 days (was 7 days)
  };

  private constructor() {}

  static getInstance(): OptimizedCacheManager {
    if (!OptimizedCacheManager.instance) {
      OptimizedCacheManager.instance = new OptimizedCacheManager();
    }
    return OptimizedCacheManager.instance;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string, prefix?: string): string {
    const basePrefix = prefix || 'shifteasy';
    return `${basePrefix}:${key}`;
  }

  /**
   * Cache schedule data with optimized TTL
   */
  async cacheSchedule(
    tenantId: string,
    scheduleId: string,
    data: any,
    ttl?: number
  ): Promise<boolean> {
    const key = this.generateKey(`schedule:${tenantId}:${scheduleId}`, 'schedule');
    const value = JSON.stringify(data);
    return await optimizedRedisClient.set(key, value, ttl || this.TTL_CONFIG.schedule);
  }

  /**
   * Get cached schedule
   */
  async getCachedSchedule(tenantId: string, scheduleId: string): Promise<any | null> {
    const key = this.generateKey(`schedule:${tenantId}:${scheduleId}`, 'schedule');
    const cached = await optimizedRedisClient.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  /**
   * Cache session data with optimized TTL
   */
  async cacheSession(
    sessionId: string,
    data: any,
    ttl?: number
  ): Promise<boolean> {
    const key = this.generateKey(`session:${sessionId}`, 'session');
    const value = JSON.stringify(data);
    return await optimizedRedisClient.set(key, value, ttl || this.TTL_CONFIG.session);
  }

  /**
   * Get cached session
   */
  async getCachedSession(sessionId: string): Promise<any | null> {
    const key = this.generateKey(`session:${sessionId}`, 'session');
    const cached = await optimizedRedisClient.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  /**
   * Cache computation result with optimized TTL
   */
  async cacheComputation(
    computationKey: string,
    result: any,
    ttl?: number
  ): Promise<boolean> {
    const key = this.generateKey(`computation:${computationKey}`, 'compute');
    const value = JSON.stringify({
      result,
      timestamp: Date.now(),
    });
    return await optimizedRedisClient.set(key, value, ttl || this.TTL_CONFIG.computation);
  }

  /**
   * Get cached computation
   */
  async getCachedComputation(computationKey: string): Promise<any | null> {
    const key = this.generateKey(`computation:${computationKey}`, 'compute');
    const cached = await optimizedRedisClient.get(key);

    if (cached) {
      const data = JSON.parse(cached);
      return data.result;
    }

    return null;
  }

  /**
   * Cache API response with optimized TTL
   */
  async cacheApiResponse(
    endpoint: string,
    params: any,
    response: any,
    ttl?: number
  ): Promise<boolean> {
    // Use shorter key to reduce bandwidth
    const paramHash = this.hashParams(params);
    const key = this.generateKey(`api:${endpoint}:${paramHash}`, 'api');
    const value = JSON.stringify({
      response,
      timestamp: Date.now(),
    });
    return await optimizedRedisClient.set(key, value, ttl || this.TTL_CONFIG.api);
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(endpoint: string, params: any): Promise<any | null> {
    const paramHash = this.hashParams(params);
    const key = this.generateKey(`api:${endpoint}:${paramHash}`, 'api');
    const cached = await optimizedRedisClient.get(key);

    if (cached) {
      const data = JSON.parse(cached);
      return data.response;
    }

    return null;
  }

  /**
   * Hash params to create shorter keys
   */
  private hashParams(params: any): string {
    const str = JSON.stringify(params);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache user preferences with optimized TTL
   */
  async cacheUserPreferences(
    userId: string,
    preferences: any,
    ttl?: number
  ): Promise<boolean> {
    const key = this.generateKey(`user:${userId}:pref`, 'u'); // Shorter key
    const value = JSON.stringify(preferences);
    return await optimizedRedisClient.set(key, value, ttl || this.TTL_CONFIG.user);
  }

  /**
   * Get cached user preferences
   */
  async getCachedUserPreferences(userId: string): Promise<any | null> {
    const key = this.generateKey(`user:${userId}:pref`, 'u');
    const cached = await optimizedRedisClient.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  /**
   * Invalidate specific cache entries
   */
  async invalidate(keys: string | string[]): Promise<number> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const fullKeys = keysArray.map(k => this.generateKey(k));
    return await optimizedRedisClient.del(fullKeys);
  }

  /**
   * Invalidate schedule cache
   */
  async invalidateSchedule(tenantId: string, scheduleId?: string): Promise<number> {
    if (scheduleId) {
      const key = this.generateKey(`schedule:${tenantId}:${scheduleId}`, 'schedule');
      return await optimizedRedisClient.del(key);
    }
    // For pattern invalidation, we need to maintain a list of keys
    console.warn('Pattern invalidation avoided. Use specific keys instead.');
    return 0;
  }

  /**
   * Invalidate session cache
   */
  async invalidateSession(sessionId: string): Promise<number> {
    const key = this.generateKey(`session:${sessionId}`, 'session');
    return await optimizedRedisClient.del(key);
  }

  /**
   * Warm up cache with frequently accessed data (batched)
   */
  async warmUpCache(data: { key: string; value: any; ttl?: number }[]): Promise<void> {
    // Process in batches to reduce commands
    const batchSize = 10;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const promises = batch.map(item => {
        const key = this.generateKey(item.key);
        const value = JSON.stringify(item.value);
        return optimizedRedisClient.set(key, value, item.ttl || this.defaultTTL);
      });

      await Promise.all(promises);
    }

    console.log(`Warmed up cache with ${data.length} items`);
  }

  /**
   * Get cache statistics
   */
  getStatistics() {
    return optimizedRedisClient.getStats();
  }

  /**
   * Clear local cache only (not remote)
   */
  clearLocalCache(): void {
    optimizedRedisClient.clearLocalCache();
  }

  /**
   * Batch get multiple keys (optimized)
   */
  async batchGet(keys: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const fullKeys = keys.map(k => this.generateKey(k));

    // Use mget for batch retrieval
    const values = await optimizedRedisClient.mget(fullKeys);

    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        try {
          results.set(key, JSON.parse(value));
        } catch {
          results.set(key, value);
        }
      }
    });

    return results;
  }

  /**
   * Batch set multiple keys (optimized)
   */
  async batchSet(items: { key: string; value: any; ttl?: number }[]): Promise<void> {
    // Process items individually but batched internally
    for (const item of items) {
      const fullKey = this.generateKey(item.key);
      const value = JSON.stringify(item.value);
      await optimizedRedisClient.set(fullKey, value, item.ttl || this.defaultTTL);
    }
  }

  /**
   * Implement cache-aside pattern with local cache
   */
  async cacheAside<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const fullKey = this.generateKey(key, options.prefix);

    // Try to get from cache (local first, then remote)
    const cached = await optimizedRedisClient.get(fullKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return cached as T;
      }
    }

    // Cache miss - fetch from source
    const data = await fetchFunction();

    // Store in cache
    const value = JSON.stringify(data);
    await optimizedRedisClient.set(fullKey, value, options.ttl || this.defaultTTL);

    return data;
  }

  /**
   * Force flush pending writes
   */
  async flush(): Promise<void> {
    await optimizedRedisClient.flush();
  }
}

export const optimizedCacheManager = OptimizedCacheManager.getInstance();