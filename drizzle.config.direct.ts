import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Direct connection for schema changes
    url: 'postgresql://postgres:t5XCHGQNpjNX1N5s@db.hnjyatneamlmbreudyzj.supabase.co:5432/postgres',
  },
  verbose: true,
  strict: true,
});