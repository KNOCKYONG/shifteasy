import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use SESSION_URL for migrations to avoid IPv6 issues
    url: process.env.SESSION_URL!,
  },
  verbose: true,
  strict: false, // Disable strict mode to avoid interactive prompts
});