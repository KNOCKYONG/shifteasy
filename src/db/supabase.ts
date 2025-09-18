import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase client for auth and realtime features
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Supabase Admin client for server-side operations
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Direct database connection for Drizzle ORM
const connectionString = process.env.DATABASE_URL!;

// Configure postgres client for Supabase with connection pooling
const queryClient = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Idle timeout in seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Drizzle ORM instance
export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === 'development' // Enable logging in development
});

// Migration client (uses direct URL without pgbouncer)
let migrationClient: postgres.Sql | null = null;
export const getMigrationClient = () => {
  if (!migrationClient) {
    migrationClient = postgres(process.env.DIRECT_URL!, {
      prepare: false,
      ssl: 'require',
      max: 1
    });
  }
  return migrationClient;
};

// Export types
export type Database = typeof db;