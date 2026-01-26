import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient instance.
 *
 * This is exported so it can be used by the auth store to clear caches on logout.
 * This is critical for security - when a user logs out, we must clear all cached
 * data to prevent the next user from seeing the previous user's data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 1, // 1 minute - balance between freshness and performance
      gcTime: 1000 * 60 * 5, // 5 minutes garbage collection (previously cacheTime)
      retry: 1,
      refetchOnWindowFocus: true, // Refresh data when user returns to tab
      refetchOnReconnect: true, // Refresh when network reconnects
    },
  },
});

/**
 * Clear all cached queries.
 *
 * CRITICAL: Must be called on logout to prevent data leakage between users.
 */
export function clearQueryCache(): void {
  queryClient.clear();
}
