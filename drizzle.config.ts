import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Prefer SESSION_POOL_URL (5432, long-lived, DDL allowed), then DIRECT_URL.
// Ensure sslmode=require for Supabase.
const addSslMode = (url?: string) => {
  if (!url) return url;
  return url.includes('sslmode=') ? url : (url.includes('?') ? `${url}&sslmode=require` : `${url}?sslmode=require`);
};

const forceDirect = process.env.DRIZZLE_USE_DIRECT === '1';
const databaseUrl = addSslMode(
  (forceDirect ? process.env.DIRECT_URL : process.env.DATABASE_URL) ||
  process.env.DATABASE_URL ||
  process.env.DRIZZLE_DATABASE_URL ||
  process.env.SESSION_POOL_URL
);

if (!databaseUrl) {
  throw new Error('Database URL is not set in environment variables');
}

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  },
  verbose: true,
  strict: true,
});
