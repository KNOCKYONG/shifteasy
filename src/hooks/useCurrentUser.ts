'use client';

import { useSession } from '@supabase/auth-helpers-react';
import { api } from '@/lib/trpc/client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useCurrentUser() {
  const session = useSession();
  const userId = session?.user?.id ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      queryClient.clear();
    }
  }, [userId, queryClient]);

  const { data: currentUserData } = api.tenant.users.current.useQuery(
    undefined,
    {
      enabled: !!userId,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  const isLoaded = session !== undefined;

  return {
    isLoaded,
    userId,
    orgId: null,
    supabaseUser: session?.user ?? null,
    dbUser: currentUserData,
    role: currentUserData?.role || 'member',
    name:
      currentUserData?.name ||
      (session?.user?.user_metadata?.name as string | undefined) ||
      session?.user?.email ||
      '',
    email: currentUserData?.email || session?.user?.email || '',
    tenantPlan: currentUserData?.tenantPlan ?? null,
  };
}
