import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/api/root';

export const api = createTRPCReact<AppRouter>();

// Export hooks for use in components
export const {
  useQuery,
  useMutation,
  useSubscription,
  useInfiniteQuery,
  Provider,
} = api;