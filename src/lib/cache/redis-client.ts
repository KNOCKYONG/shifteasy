/**
 * Redis Client for caching with Upstash support
 */

import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private upstashClient: UpstashRedis | null = null;
  private isConnected: boolean = false;
  private mockCache: Map<string, { value: string; expiry?: number }> = new Map();
  private useMockCache: boolean = false;
  private useUpstash: boolean = false;

  private constructor() {
    this.initializeClient();
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private async initializeClient() {
    try {
      // First try Upstash Redis if configured
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        console.log('Using Upstash Redis');
        this.upstashClient = new UpstashRedis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        this.useUpstash = true;
        this.isConnected = true;
        return;
      }

      // In development, use mock cache if Redis is not available
      if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
        console.log('Using in-memory cache (Redis not configured)');
        this.useMockCache = true;
        this.isConnected = true;
        return;
      }

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('Redis connection failed, switching to mock cache');
            this.useMockCache = true;
            this.isConnected = true;
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        console.log('Redis connected');
        this.isConnected = true;
        this.useMockCache = false;
      });

      this.client.on('error', (error) => {
        console.error('Redis error:', error);
        this.useMockCache = true;
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
        this.useMockCache = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      this.useMockCache = true;
      this.isConnected = true; // Use mock cache
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    if (this.useMockCache) {
      const cached = this.mockCache.get(key);
      if (cached) {
        if (cached.expiry && cached.expiry < Date.now()) {
          this.mockCache.delete(key);
          return null;
        }
        return cached.value;
      }
      return null;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        const result = await this.upstashClient.get(key);
        return result as string | null;
      } catch (error) {
        console.error('Upstash get error:', error);
        return null;
      }
    }

    if (!this.client || !this.isConnected) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (this.useMockCache) {
      this.mockCache.set(key, {
        value,
        expiry: ttl ? Date.now() + (ttl * 1000) : undefined,
      });
      return true;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        if (ttl) {
          await this.upstashClient.set(key, value, { ex: ttl });
        } else {
          await this.upstashClient.set(key, value);
        }
        return true;
      } catch (error) {
        console.error('Upstash set error:', error);
        return false;
      }
    }

    if (!this.client || !this.isConnected) return false;

    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string | string[]): Promise<number> {
    if (this.useMockCache) {
      const keys = Array.isArray(key) ? key : [key];
      let deleted = 0;
      keys.forEach(k => {
        if (this.mockCache.delete(k)) deleted++;
      });
      return deleted;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        const keys = Array.isArray(key) ? key : [key];
        const result = await this.upstashClient.del(...keys);
        return result;
      } catch (error) {
        console.error('Upstash del error:', error);
        return 0;
      }
    }

    if (!this.client || !this.isConnected) return 0;

    try {
      return await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.useMockCache) {
      const cached = this.mockCache.get(key);
      if (cached) {
        if (cached.expiry && cached.expiry < Date.now()) {
          this.mockCache.delete(key);
          return false;
        }
        return true;
      }
      return false;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        const result = await this.upstashClient.exists(key);
        return result === 1;
      } catch (error) {
        console.error('Upstash exists error:', error);
        return false;
      }
    }

    if (!this.client || !this.isConnected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (this.useMockCache) {
      const keys = Array.from(this.mockCache.keys());
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        // Upstash doesn't support KEYS command directly, use SCAN instead
        const keys: string[] = [];
        let cursor = 0;
        do {
          const result = await this.upstashClient.scan(cursor, { match: pattern, count: 100 });
          cursor = result[0];
          keys.push(...(result[1] as string[]));
        } while (cursor !== 0);
        return keys;
      } catch (error) {
        console.error('Upstash keys error:', error);
        return [];
      }
    }

    if (!this.client || !this.isConnected) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    if (this.useMockCache) {
      const current = this.mockCache.get(key);
      const value = current ? parseInt(current.value) + 1 : 1;
      this.mockCache.set(key, { value: value.toString() });
      return value;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        return await this.upstashClient.incr(key);
      } catch (error) {
        console.error('Upstash incr error:', error);
        return 0;
      }
    }

    if (!this.client || !this.isConnected) return 0;

    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      return 0;
    }
  }

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    if (this.useMockCache) {
      const hashKey = `${key}:${field}`;
      this.mockCache.set(hashKey, { value });
      return 1;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        await this.upstashClient.hset(key, { [field]: value });
        return 1;
      } catch (error) {
        console.error('Upstash hset error:', error);
        return 0;
      }
    }

    if (!this.client || !this.isConnected) return 0;

    try {
      return await this.client.hset(key, field, value);
    } catch (error) {
      console.error('Redis hset error:', error);
      return 0;
    }
  }

  /**
   * Get hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    if (this.useMockCache) {
      const hashKey = `${key}:${field}`;
      const cached = this.mockCache.get(hashKey);
      return cached ? cached.value : null;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        const result = await this.upstashClient.hget(key, field);
        return result as string | null;
      } catch (error) {
        console.error('Upstash hget error:', error);
        return null;
      }
    }

    if (!this.client || !this.isConnected) return null;

    try {
      return await this.client.hget(key, field);
    } catch (error) {
      console.error('Redis hget error:', error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.useMockCache) {
      const result: Record<string, string> = {};
      const prefix = `${key}:`;
      this.mockCache.forEach((value, k) => {
        if (k.startsWith(prefix)) {
          const field = k.substring(prefix.length);
          result[field] = value.value;
        }
      });
      return result;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        const result = await this.upstashClient.hgetall(key);
        return result || {};
      } catch (error) {
        console.error('Upstash hgetall error:', error);
        return {};
      }
    }

    if (!this.client || !this.isConnected) return {};

    try {
      return await this.client.hgetall(key) || {};
    } catch (error) {
      console.error('Redis hgetall error:', error);
      return {};
    }
  }

  /**
   * Set expiration time
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.useMockCache) {
      const cached = this.mockCache.get(key);
      if (cached) {
        cached.expiry = Date.now() + (seconds * 1000);
        return true;
      }
      return false;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        const result = await this.upstashClient.expire(key, seconds);
        return result === 1;
      } catch (error) {
        console.error('Upstash expire error:', error);
        return false;
      }
    }

    if (!this.client || !this.isConnected) return false;

    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async flushall(): Promise<void> {
    if (this.useMockCache) {
      this.mockCache.clear();
      return;
    }

    if (this.useUpstash && this.upstashClient) {
      try {
        await this.upstashClient.flushdb();
      } catch (error) {
        console.error('Upstash flushall error:', error);
      }
      return;
    }

    if (!this.client || !this.isConnected) return;

    try {
      await this.client.flushall();
    } catch (error) {
      console.error('Redis flushall error:', error);
    }
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
    if (this.upstashClient) {
      this.upstashClient = null;
      this.isConnected = false;
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

export const redisClient = RedisClient.getInstance();