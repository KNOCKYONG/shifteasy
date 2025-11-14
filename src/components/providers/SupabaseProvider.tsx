'use client';

import { useState, type ReactNode } from 'react';
import {
  SessionContextProvider,
  type SessionContextProviderProps,
} from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

type SupabaseProviderProps = Omit<
  SessionContextProviderProps,
  'supabaseClient'
> & {
  children: ReactNode;
};

export function SupabaseProvider({
  children,
  initialSession,
}: SupabaseProviderProps) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={initialSession}
    >
      {children}
    </SessionContextProvider>
  );
}
