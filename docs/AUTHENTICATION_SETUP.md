# ShiftEasy Authentication Setup Guide

## Overview
ShiftEasy uses Clerk for authentication with role-based access control. The system has been re-enabled after temporary deactivation for development.

## Changes Made

### 1. Re-enabled Clerk Authentication
- **File**: `src/server/trpc.ts`
- Restored Clerk imports and authentication logic
- Now properly syncs users between Clerk and database
- Maintains tenant isolation and role-based permissions

### 2. Added Current User Hook
- **File**: `src/hooks/useCurrentUser.ts`
- Provides easy access to current user information
- Returns user role, name, email, and database user data

### 3. Updated Team Management Page
- **File**: `src/app/team/page.tsx`
- Now uses actual user authentication
- Position editing restricted to authorized roles (owner, admin, manager)
- Removed hardcoded test user data

### 4. Added Current User Endpoint
- **File**: `src/server/api/routers/tenant.ts`
- Added `users.current` query to get current authenticated user

## Test Accounts

Run the setup script to configure test accounts:
```bash
npx tsx scripts/setup-test-accounts.ts
```

### Available Test Accounts

| Email | Role | Position | Permissions |
|-------|------|----------|-------------|
| **owner@shifteasy.com** | Owner | 병원장 | • Full system access<br>• Can change all positions<br>• Can manage all settings |
| **admin@shifteasy.com** | Admin | 간호부장 | • Administrative access<br>• Can change member positions<br>• Can manage departments |
| **manager@shifteasy.com** | Manager | 수간호사 | • Team management<br>• Can change member positions<br>• Can approve schedules |
| **nurse1@shifteasy.com** | Member | 간호사 | • View schedules<br>• Submit preferences<br>• Cannot change positions |
| **nurse2@shifteasy.com** | Member | 간호사 | • View schedules<br>• Submit preferences<br>• Cannot change positions |

### Organization Details
- **Organization Name**: ShiftEasy Test Hospital
- **Secret Code**: `TEST-2024`
- **Tenant ID**: `3760b5ec-462f-443c-9a90-4a2b2e295e9d`

## How to Set Up and Test

### 1. Sign Up Test Accounts in Clerk

1. Go to http://localhost:3000/sign-up
2. Sign up with each test email:
   - Use any password (minimum 8 characters)
   - Complete email verification if required
3. After signup, you'll be prompted to join an organization:
   - Enter the secret code: `TEST-2024`
   - This will link the Clerk account to the existing database user

### 2. Test Position Editing Feature

1. **Sign in as Owner/Admin/Manager**:
   - Go to http://localhost:3000/team
   - Hover over any team member's position text
   - Click the edit icon (pencil) that appears
   - Enter a new position and press Enter or click save
   - The position will be updated

2. **Sign in as Member** (nurse1 or nurse2):
   - Go to http://localhost:3000/team
   - Notice that no edit icon appears on position text
   - Members cannot edit positions

### 3. Permission Hierarchy

```
Owner (owner)
  ├── Can do everything
  └── Highest authority

Admin (admin)
  ├── Can manage users and departments
  ├── Can change positions
  └── Cannot change owner settings

Manager (manager)
  ├── Can manage team schedules
  ├── Can change member positions
  └── Cannot access admin settings

Member (member)
  ├── Can view schedules
  ├── Can submit preferences
  └── Cannot change positions
```

## API Endpoints

### Check Current User
```typescript
// Using TRPC
const { data: currentUser } = api.tenant.users.current.useQuery();
```

### Update Position (Admin/Manager only)
```typescript
// Using TRPC
const updatePositionMutation = api.tenant.users.updatePosition.useMutation();

await updatePositionMutation.mutateAsync({
  userId: 'user-id',
  position: 'New Position'
});
```

## Environment Variables

Ensure these are set in `.env.local`:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWJsZS1tdXN0YW5nLTE1LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_XASVlMrvXhbtDrEGQLTJKrFVoIf2PFv4xs3eNYa7xa
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Troubleshooting

### User Not Found After Sign Up
- Make sure the user signed up with one of the test emails
- Verify they entered the correct secret code (TEST-2024)
- Check that the database has the user records (run setup script)

### Position Edit Not Working
- Verify you're signed in as owner, admin, or manager
- Check browser console for any errors
- Ensure the TRPC mutation is properly configured

### Clerk Authentication Issues
- Clear browser cookies and local storage
- Check Clerk dashboard for any configuration issues
- Verify environment variables are correctly set

## Security Notes

1. **Role-Based Access**: Position editing is restricted server-side, not just UI
2. **Tenant Isolation**: Users can only see and edit within their organization
3. **Audit Trail**: Consider adding audit logs for position changes
4. **Input Validation**: Position field validates for non-empty strings

## Next Steps

1. Add audit logging for position changes
2. Add more granular permissions
3. Implement role change functionality (for owners only)
4. Add email notifications for position changes
5. Create admin dashboard for user management