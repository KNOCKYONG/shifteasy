'use client';

import { useState } from 'react';
import {
  SessionContextProvider,
  type SessionContextProviderProps,
} from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

type SupabaseProviderProps = Omit<
  SessionContextProviderProps,
  'supabaseClient'
>;

export function SupabaseProvider({
  children,
  initialSession,
}: SupabaseProviderProps) {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient());

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={initialSession}
    >
      {children}
    </SessionContextProvider>
  );
}
