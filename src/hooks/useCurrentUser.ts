'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { api } from '@/lib/trpc/client';

export function useCurrentUser() {
  const { isLoaded: authLoaded, userId, orgId } = useAuth();
  const { isLoaded: userLoaded, user: clerkUser } = useUser();

  // Get user from database through TRPC
  const { data: currentUserData } = api.tenant.users.current.useQuery(
    undefined,
    {
      enabled: !!userId && !!orgId,
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
  };
}