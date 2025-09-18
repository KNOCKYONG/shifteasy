import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use Transaction Pooler for app connections (pgbouncer)
// This is best for serverless/edge functions with short-lived connections
const connectionString = process.env.DATABASE_URL!;

// Configure postgres client for Supabase Transaction Pooler
const client = postgres(connectionString, {
  prepare: false, // Required for pgbouncer
  ssl: 'require', // Required for Supabase
  connection: {
    application_name: 'shifteasy-app'
  }
});

export const db = drizzle(client, { schema });

export type Database = typeof db;