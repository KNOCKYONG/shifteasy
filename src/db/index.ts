import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase connection with pgbouncer for connection pooling
const connectionString = process.env.DATABASE_URL!;

// Configure postgres client for Supabase
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require' // Required for Supabase
});

export const db = drizzle(client, { schema });

export type Database = typeof db;