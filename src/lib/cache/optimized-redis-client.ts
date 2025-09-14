/**
 * Optimized Redis Client with local caching and batching
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

interface CacheEntry {
  value: any;
  expiry: number;
  lastAccess: number;
}

export class OptimizedRedisClient {
  private static instance: OptimizedRedisClient;
  private upstashClient: UpstashRedis | null = null;
  private ioredisClient: Redis | null = null;

  // Local cache to reduce Redis calls
  private localCache: Map<string, CacheEntry> = new Map();
  private readonly LOCAL_CACHE_MAX_SIZE = 1000;
  private readonly LOCAL_CACHE_TTL = 60000; // 1 minute local cache

  // Batch operations
  private pendingWrites: Map<string, { value: string; ttl?: number }> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL = 100; // 100ms batching window

  // Statistics
  private stats = {
    localHits: 0,
    remoteCalls: 0,
    batchedWrites: 0,
  };

  private constructor() {
    this.initializeClient();
    this.startCacheCleanup();
  }

  static getInstance(): OptimizedRedisClient {
    if (!OptimizedRedisClient.instance) {
      OptimizedRedisClient.instance = new OptimizedRedisClient();
    }
    return OptimizedRedisClient.instance;
  }

  private initializeClient(): void {
    // Prioritize Upstash if available
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('Using Upstash Redis with optimization');
      this.upstashClient = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else if (process.env.REDIS_URL) {
      console.log('Using ioredis');
      this.ioredisClient = new Redis(process.env.REDIS_URL);
    } else {
      console.log('Using local cache only');
    }
  }

  /**
   * Clean up expired entries from local cache
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      this.localCache.forEach((entry, key) => {
        if (entry.expiry < now) {
          toDelete.push(key);
        }
      });

      toDelete.forEach(key => this.localCache.delete(key));

      // Also enforce max size using LRU
      if (this.localCache.size > this.LOCAL_CACHE_MAX_SIZE) {
        const entries = Array.from(this.localCache.entries());
        entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

        const toRemove = entries.slice(0, entries.length - this.LOCAL_CACHE_MAX_SIZE);
        toRemove.forEach(([key]) => this.localCache.delete(key));
      }
    }, 30000); // Clean up every 30 seconds
  }

  /**
   * Get with local cache first
   */
  async get(key: string): Promise<string | null> {
    // Check local cache first
    const cached = this.localCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      this.stats.localHits++;
      cached.lastAccess = Date.now();
      return cached.value;
    }

    // Remove expired entry
    if (cached) {
      this.localCache.delete(key);
    }

    // Fetch from Redis
    this.stats.remoteCalls++;
    let value: string | null = null;

    try {
      if (this.upstashClient) {
        value = await this.upstashClient.get(key) as string | null;
      } else if (this.ioredisClient) {
        value = await this.ioredisClient.get(key);
      }

      // Store in local cache if found
      if (value !== null) {
        this.localCache.set(key, {
          value,
          expiry: Date.now() + this.LOCAL_CACHE_TTL,
          lastAccess: Date.now(),
        });
      }

      return value;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Batch set operations
   */
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    // Update local cache immediately
    this.localCache.set(key, {
      value,
      expiry: Date.now() + (ttl ? ttl * 1000 : this.LOCAL_CACHE_TTL),
      lastAccess: Date.now(),
    });

    // Add to pending writes
    this.pendingWrites.set(key, { value, ttl });

    // Schedule batch write
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_INTERVAL);
    }

    return true;
  }

  /**
   * Flush pending writes to Redis
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingWrites.size === 0) {
      this.batchTimer = null;
      return;
    }

    const writes = Array.from(this.pendingWrites.entries());
    this.pendingWrites.clear();
    this.batchTimer = null;
    this.stats.batchedWrites += writes.length;

    try {
      if (this.upstashClient) {
        // Use pipeline for Upstash
        const pipeline = this.upstashClient.pipeline();

        for (const [key, { value, ttl }] of writes) {
          if (ttl) {
            pipeline.set(key, value, { ex: ttl });
          } else {
            pipeline.set(key, value);
          }
        }

        await pipeline.exec();
      } else if (this.ioredisClient) {
        // Use pipeline for ioredis
        const pipeline = this.ioredisClient.pipeline();

        for (const [key, { value, ttl }] of writes) {
          if (ttl) {
            pipeline.setex(key, ttl, value);
          } else {
            pipeline.set(key, value);
          }
        }

        await pipeline.exec();
      }
    } catch (error) {
      console.error('Batch write error:', error);
    }
  }

  /**
   * Delete with local cache invalidation
   */
  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];

    // Remove from local cache
    keys.forEach(k => this.localCache.delete(k));

    // Remove from pending writes
    keys.forEach(k => this.pendingWrites.delete(k));

    if (!this.upstashClient && !this.ioredisClient) {
      return keys.length;
    }

    this.stats.remoteCalls++;

    try {
      if (this.upstashClient) {
        return await this.upstashClient.del(...keys);
      } else if (this.ioredisClient) {
        return await this.ioredisClient.del(...keys);
      }
      return 0;
    } catch (error) {
      console.error('Redis del error:', error);
      return 0;
    }
  }

  /**
   * Check existence with cache
   */
  async exists(key: string): Promise<boolean> {
    // Check local cache first
    const cached = this.localCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return true;
    }

    // Check pending writes
    if (this.pendingWrites.has(key)) {
      return true;
    }

    if (!this.upstashClient && !this.ioredisClient) {
      return false;
    }

    this.stats.remoteCalls++;

    try {
      if (this.upstashClient) {
        return (await this.upstashClient.exists(key)) === 1;
      } else if (this.ioredisClient) {
        return (await this.ioredisClient.exists(key)) === 1;
      }
      return false;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Increment with local tracking
   */
  async incr(key: string): Promise<number> {
    // Invalidate local cache
    this.localCache.delete(key);

    if (!this.upstashClient && !this.ioredisClient) {
      return 0;
    }

    this.stats.remoteCalls++;

    try {
      let result: number;

      if (this.upstashClient) {
        result = await this.upstashClient.incr(key);
      } else if (this.ioredisClient) {
        result = await this.ioredisClient.incr(key);
      } else {
        return 0;
      }

      // Update local cache
      this.localCache.set(key, {
        value: result.toString(),
        expiry: Date.now() + this.LOCAL_CACHE_TTL,
        lastAccess: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Redis incr error:', error);
      return 0;
    }
  }

  /**
   * Get multiple keys with single call
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = new Array(keys.length);
    const missingIndices: number[] = [];
    const missingKeys: string[] = [];

    // Check local cache first
    keys.forEach((key, index) => {
      const cached = this.localCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        this.stats.localHits++;
        cached.lastAccess = Date.now();
        results[index] = cached.value;
      } else {
        missingIndices.push(index);
        missingKeys.push(key);
      }
    });

    // If all found in cache, return immediately
    if (missingKeys.length === 0) {
      return results;
    }

    // Fetch missing keys from Redis
    if (this.upstashClient || this.ioredisClient) {
      this.stats.remoteCalls++;

      try {
        let values: (string | null)[];

        if (this.upstashClient) {
          values = await this.upstashClient.mget(...missingKeys) as (string | null)[];
        } else if (this.ioredisClient) {
          values = await this.ioredisClient.mget(...missingKeys);
        } else {
          values = new Array(missingKeys.length).fill(null);
        }

        // Update results and cache
        values.forEach((value, i) => {
          const index = missingIndices[i];
          const key = missingKeys[i];

          results[index] = value;

          if (value !== null) {
            this.localCache.set(key, {
              value,
              expiry: Date.now() + this.LOCAL_CACHE_TTL,
              lastAccess: Date.now(),
            });
          }
        });
      } catch (error) {
        console.error('Redis mget error:', error);
        missingIndices.forEach(index => {
          results[index] = null;
        });
      }
    }

    return results;
  }

  /**
   * Force flush pending writes
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.flushBatch();
  }

  /**
   * Get statistics
   */
  getStats() {
    const hitRate = this.stats.localHits / (this.stats.localHits + this.stats.remoteCalls) || 0;
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      localCacheSize: this.localCache.size,
      pendingWrites: this.pendingWrites.size,
    };
  }

  /**
   * Clear local cache
   */
  clearLocalCache(): void {
    this.localCache.clear();
    this.stats.localHits = 0;
    this.stats.remoteCalls = 0;
    this.stats.batchedWrites = 0;
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    await this.flush();

    if (this.ioredisClient) {
      await this.ioredisClient.quit();
      this.ioredisClient = null;
    }

    this.upstashClient = null;
    this.localCache.clear();
  }
}

export const optimizedRedisClient = OptimizedRedisClient.getInstance();