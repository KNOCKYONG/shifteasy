import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use SESSION_URL for migrations (supports DDL operations)
    // Direct URL has IPv6 issues on some networks
    url: process.env.SESSION_URL || process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: false,
});