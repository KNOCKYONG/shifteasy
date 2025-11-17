import { Injectable, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class UpstashService {
  private readonly logger = new Logger(UpstashService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      this.logger.warn('Upstash Redis credentials not provided. Scheduler jobs will be disabled.');
      return;
    }

    this.client = new Redis({ url, token });
  }

  get redis(): Redis {
    if (!this.client) {
      throw new Error('Upstash Redis is not configured');
    }
    return this.client;
  }
}
