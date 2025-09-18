# Deployment Guide

## Vercel Deployment

### Required Environment Variables

Add these environment variables in Vercel Dashboard (Settings → Environment Variables):

#### Database (Supabase)
```
DATABASE_URL=postgresql://postgres.hnjyatneamlmbreudyzj:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.hnjyatneamlmbreudyzj.supabase.co:5432/postgres?sslmode=require
SESSION_POOL_URL=postgresql://postgres.hnjyatneamlmbreudyzj:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require
```

#### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://hnjyatneamlmbreudyzj.supabase.co
SUPABASE_URL=https://hnjyatneamlmbreudyzj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
```

#### Application
```
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

### Build Settings

Vercel should automatically detect Next.js, but ensure these settings:

- **Build Command**: `npm run build` or leave as default
- **Output Directory**: `.next` or leave as default
- **Install Command**: `npm install` or leave as default

### Important Notes

1. **Do NOT commit `.env.local` to repository** - it contains sensitive keys
2. **Database Migrations**: Run migrations locally and push schema changes via Supabase Dashboard
3. **Development vs Production**: Use different Supabase projects for development and production

### Deployment Steps

1. Push code to GitHub
2. Import repository in Vercel
3. Add environment variables
4. Deploy

### Troubleshooting

#### Build Errors
- Check all environment variables are set
- Check for TypeScript errors: `npm run build` locally
- Ensure all dependencies are in `package.json` (not devDependencies if needed for build)

#### Runtime Errors
- Check Vercel Function logs
- Verify database connection strings
- Ensure Supabase project is accessible

#### Database Connection Issues
- Use pooler connection strings for serverless functions
- Verify SSL settings are correct
- Check if IP allowlist is configured in Supabase