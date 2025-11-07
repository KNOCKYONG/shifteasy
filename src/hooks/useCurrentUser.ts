'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { api } from '@/lib/trpc/client';
import { useEffect } from 'react';

export function useCurrentUser() {
  const { isLoaded: authLoaded, userId, orgId } = useAuth();
  const { isLoaded: userLoaded, user: clerkUser } = useUser();

  // Get user from database through TRPC with error handling
  const {
    data: currentUserData,
    isLoading: isLoadingDbUser,
    error,
    refetch
  } = api.tenant.users.current.useQuery(
    undefined,
    {
      enabled: !!userId,
      retry: 3,
      retryDelay: 1000,
      staleTime: 30000, // 30 seconds
    }
  );

  // Debug logging for errors
  useEffect(() => {
    if (error) {
      console.error('❌ TRPC tenant.users.current error:', error);
      console.log('🔍 Error details:', {
        message: error.message,
        data: error.data,
        shape: error.shape,
      });
    }
  }, [error]);

  // Debug logging for query state
  useEffect(() => {
    if (userId && authLoaded && userLoaded) {
      console.log('🔍 useCurrentUser state:', {
        authLoaded,
        userLoaded,
        userId: userId || 'NO_USER_ID',
        orgId: orgId || 'NO_ORG_ID',
        isLoadingDbUser,
        hasDbUser: !!currentUserData,
        dbUserRole: currentUserData?.role,
        hasError: !!error,
      });
    }
  }, [authLoaded, userLoaded, userId, orgId, isLoadingDbUser, currentUserData, error]);

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
    error,
    refetch,
    isLoadingDbUser,
  };
}