# ShiftEasy Vercel Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Environment Variables Setup (CRITICAL)
- [ ] **SUPABASE_URL** - Added to Vercel ⚠️ **REQUIRED**
- [ ] **NEXT_PUBLIC_SUPABASE_URL** - Added to Vercel ⚠️ **REQUIRED**
- [ ] **SUPABASE_ANON_KEY** - Added to Vercel ⚠️ **REQUIRED**
- [ ] **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Added to Vercel ⚠️ **REQUIRED**
- [ ] **SUPABASE_SERVICE_ROLE_KEY** - Added to Vercel ⚠️ **REQUIRED**
- [ ] **DATABASE_URL** - Added to Vercel ⚠️ **REQUIRED**
- [ ] **DIRECT_URL** - Added to Vercel (for migrations)
- [ ] **SESSION_POOL_URL** - Added to Vercel (for session pooling)
- [ ] **NODE_ENV** - Set to `production`
- [ ] **NEXT_PUBLIC_APP_URL** - Set to your Vercel app URL

### 2. Package Configuration ✅ COMPLETED
- [x] Node version specified in `package.json` (>=18.0.0)
- [x] `.nvmrc` file created with Node 18.18.0
- [x] Removed conflicting `pnpm-lock.yaml`
- [x] `package-lock.json` properly generated with npm

### 3. Database Setup
- [ ] Supabase project created and configured
- [ ] Database schema pushed (`npm run db:push`)
- [ ] Initial seed data loaded (`npm run db:seed`)
- [ ] Test database connection locally

### 4. Build Verification
- [ ] Local build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] All dependencies properly installed

### 5. Optional Services
- [ ] Redis/Upstash configured (optional - for rate limiting)
- [ ] Clerk authentication configured (optional - future use)

## 🚀 Deployment Steps

### Step 1: Add Environment Variables to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your "shifteasy" project
3. Navigate to Settings → Environment Variables
4. Add each variable from `docs/VERCEL_ENV_SETUP.md`
5. Select all environments (Production, Preview, Development)
6. Save each variable

### Step 2: Trigger Deployment
1. Either push a commit to trigger auto-deployment
2. Or click "Redeploy" in Vercel dashboard
3. Select the latest commit with environment fixes

### Step 3: Verify Deployment
1. Check build logs for any errors
2. Verify the deployment URL works
3. Test basic functionality (navigation, database connection)

## 🔍 Common Issues & Solutions

### Issue: "supabaseUrl is required"
**Solution**: Add all SUPABASE_* environment variables to Vercel

### Issue: "Cannot find module"
**Solution**: Clear Vercel cache and redeploy

### Issue: Build timeout
**Solution**: Increase build timeout in Vercel settings or optimize build

### Issue: Database connection errors
**Solution**: Verify DATABASE_URL and connection pooling settings

## 📊 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Code | ✅ Ready | All build errors fixed locally |
| Package Manager | ✅ Fixed | Using npm, removed pnpm conflicts |
| Node Version | ✅ Fixed | Specified Node 18+ |
| Environment Variables | ❌ **ACTION NEEDED** | Must be added to Vercel |
| Database | ⚠️ Pending | Needs environment variables first |
| Deployment | ⚠️ Blocked | Waiting for env variables |

## 📝 Notes

- **Priority**: Add Supabase environment variables first - this is blocking deployment
- **Redis Errors**: Expected in development, will work with Upstash in production
- **Clerk Auth**: Optional for now, can be added later

## 🎯 Next Actions

1. **IMMEDIATE**: Add environment variables to Vercel (see `docs/VERCEL_ENV_SETUP.md`)
2. **THEN**: Redeploy from Vercel dashboard
3. **VERIFY**: Check deployment URL and test basic functionality
4. **OPTIONAL**: Configure Redis/Upstash for rate limiting

---

Last Updated: 2025-01-18
Status: Awaiting environment variable configuration in Vercel