/**
 * Optimized React Query configuration for maximum caching and performance.
 * Reduces API calls, keeps data fresh, and handles stale states gracefully.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes — no refetch during this window
      staleTime: 5 * 60 * 1000,

      // Keep unused queries in cache for 30 minutes
      gcTime: 30 * 60 * 1000,

      // Retry failed requests 2 times before showing error
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus (when user comes back from another tab)
      refetchOnWindowFocus: true,

      // Refetch when user comes back online
      refetchOnReconnect: 'stale',

      // Don't refetch if data is fresh (within staleTime)
      refetchOnMount: 'stale',
    },

    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

// Export pre-configured options for common scenarios
export const queryOptions = {
  // Static data (schools, classes, users) — cache for 1 hour
  staticData: {
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  },

  // Frequently updated data (attendance, payments) — cache for 2 minutes
  frequentData: {
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },

  // Real-time data (current status) — no caching
  realtimeData: {
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
    refetchInterval: 10000, // Refetch every 10 seconds
  },

  // List data (searchable, filterable) — cache for 3 minutes
  listData: {
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  },
};
