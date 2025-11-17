/**
 * Redis Client for caching
 */

import Redis from 'ioredis';

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private mockCache: Map<string, { value: string; expiry?: number }> = new Map();
  private useMockCache: boolean = false;

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
      const shouldUseMock =
        !process.env.REDIS_URL ||
        process.env.DISABLE_REDIS === 'true' ||
        process.env.VERCEL === '1';

      if (shouldUseMock) {
        console.log('Using in-memory cache for Redis (configuration missing or disabled)');
        this.useMockCache = true;
        this.isConnected = true;
        return;
      }

      const redisUrl = process.env.REDIS_URL as string;

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

    if (!this.client || !this.isConnected) return 0;

    try {
      if (Array.isArray(key)) {
        return await this.client.del(...key);
      } else {
        return await this.client.del(key);
      }
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
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

export const redisClient = RedisClient.getInstance();
