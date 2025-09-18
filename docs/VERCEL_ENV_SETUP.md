# Vercel Environment Variables Setup

## Required Environment Variables

Copy these environment variables from your `.env.local` file to Vercel Dashboard:

### 1. Go to Vercel Dashboard
- Navigate to your project settings
- Click on "Environment Variables" tab
- Add the following variables:

### Database (Supabase PostgreSQL)
```
DATABASE_URL=postgresql://postgres.hnjyatneamlmbreudyzj:t5XCHGQNpjNX1N5s@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:t5XCHGQNpjNX1N5s@db.hnjyatneamlmbreudyzj.supabase.co:5432/postgres?sslmode=require
SESSION_POOL_URL=postgresql://postgres.hnjyatneamlmbreudyzj:t5XCHGQNpjNX1N5s@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require
```

### Supabase (REQUIRED - These are causing the build error)
```
NEXT_PUBLIC_SUPABASE_URL=https://hnjyatneamlmbreudyzj.supabase.co
SUPABASE_URL=https://hnjyatneamlmbreudyzj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuanlhdG5lYW1sbWJyZXVkeXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NjIzNjcsImV4cCI6MjA3MzMzODM2N30.rAU0AfFeN8DffQnujnOQLbfWTK81hof8_r0AHtGzii8
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuanlhdG5lYW1sbWJyZXVkeXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NjIzNjcsImV4cCI6MjA3MzMzODM2N30.rAU0AfFeN8DffQnujnOQLbfWTK81hof8_r0AHtGzii8
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuanlhdG5lYW1sbWJyZXVkeXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc2MjM2NywiZXhwIjoyMDczMzM4MzY3fQ.7M3RipUC-TGrihGZPgCc552CSynG3R4lv5NUkxKPcPM
```

### Application
```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-vercel-app-url.vercel.app
```

### Development IDs (for testing)
```
DEV_TENANT_ID=3760b5ec-462f-443c-9a90-4a2b2e295e9d
DEV_USER_ID=user-1
```

### Redis (Upstash) - Optional but recommended
```
UPSTASH_REDIS_REST_URL=https://powerful-teal-54208.upstash.io
UPSTASH_REDIS_REST_TOKEN=AdPAAAIncDFiZTQ4NGU4MDM0MDc0YTQ3OTZjNzJjNjk1ODgxNDZmNHAxNTQyMDg
```

### Clerk Authentication (Optional - for future use)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWJsZS1tdXN0YW5nLTE1LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_XASVlMrvXhbtDrEGQLTJKrFVoIf2PFv4xs3eNYa7xa
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## How to Add in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project "shifteasy"
3. Go to "Settings" tab
4. Click on "Environment Variables" in the left sidebar
5. Add each variable one by one:
   - Name: Copy the variable name (e.g., `SUPABASE_URL`)
   - Value: Copy the corresponding value
   - Environment: Select all (Production, Preview, Development)
   - Click "Save"

## Important Notes

⚠️ **CRITICAL**: The build is failing because `SUPABASE_URL` and related Supabase environment variables are missing. Add these first!

⚠️ **Security**: Never commit these values to Git. Keep them only in Vercel environment variables.

⚠️ **Redis Errors**: The Redis connection errors are expected if you haven't set up Upstash Redis. The app will work without it, but rate limiting will be disabled.

## After Adding Environment Variables

1. Trigger a new deployment by pushing a commit or clicking "Redeploy" in Vercel
2. The build should succeed once all required Supabase variables are added

## Troubleshooting

If build still fails after adding variables:
1. Double-check that all Supabase URLs and keys are copied correctly
2. Ensure there are no extra spaces or line breaks in the values
3. Make sure you've selected all environments (Production, Preview, Development)
4. Try redeploying from Vercel dashboard