'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { api } from '@/lib/trpc/client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useCurrentUser() {
  const { isLoaded: authLoaded, userId, orgId } = useAuth();
  const { isLoaded: userLoaded, user: clerkUser } = useUser();
  const queryClient = useQueryClient();

  // Clear cache when userId changes (important for account switching)
  useEffect(() => {
    if (authLoaded && !userId) {
      // User logged out - clear all queries
      queryClient.clear();
    }
  }, [userId, authLoaded, queryClient]);

  // Get user from database through TRPC
  const { data: currentUserData } = api.tenant.users.current.useQuery(
    undefined,
    {
      enabled: !!userId,
      // Refetch when window regains focus to ensure fresh data
      refetchOnWindowFocus: true,
      // Invalidate cache after 1 minute to ensure account switches are detected
      staleTime: 60 * 1000,
    }
  );

  const isLoaded = authLoaded && userLoaded;

  return {
    isLoaded,
    userId,
    orgId,
    clerkUser,
    dbUser: currentUserData,
    role: currentUserData?.role || 'member',
    name: currentUserData?.name || clerkUser?.fullName || '',
    email: currentUserData?.email || clerkUser?.primaryEmailAddress?.emailAddress || '',
    tenantPlan: currentUserData?.tenantPlan ?? null,
  };
}
