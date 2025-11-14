# ShiftEasy Authentication Setup Guide

## Overview
ShiftEasy now relies entirely on **Supabase Auth** for user management, email verification, and session handling. This document explains how to configure Supabase for local development and how the application uses it.

## Required Environment Variables

Add the following to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> `SUPABASE_SERVICE_ROLE_KEY` is only used on the server (API routes) to create guest accounts or perform privileged operations. **Never expose it to the client.**

## Email Verification Flow

1. A user signs up through `/sign-up`.
2. Supabase sends a verification link automatically.
3. After the user confirms their email, they can sign in with their password.

To customize email templates or sender profiles, open **Supabase Dashboard → Authentication → Templates**.

## Local Development Checklist

1. Create a Supabase project (or reuse the existing one).
2. Update `.env.local` with the new keys.
3. Run `npm install` to ensure the Supabase helpers are available.
4. Start the dev server with `npm run dev`.

## Useful References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Dashboard](https://supabase.com/dashboard)
