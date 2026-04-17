'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  const { data, isLoading: queryLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data.data?.user ?? res.data.user ?? null;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (queryLoading) {
      setLoading(true);
      return;
    }

    // Query succeeded: sync user from server (could be null = not authenticated)
    if (!isError) {
      setUser(data ?? null);
      return;
    }

    // Query errored (network error, 5xx, etc.) — don't wipe the stored user.
    // The 401 interceptor in api.js handles true session expiry by redirecting to /login.
    setLoading(false);
  }, [data, queryLoading, isError, setUser, setLoading]);

  return {
    user: user ?? data ?? null,
    isLoading: queryLoading || isLoading,
    isAuthenticated: !!(user ?? data),
  };
}

export function useLogout() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — cookie is cleared regardless
    } finally {
      logout();
      queryClient.clear();
      window.location.href = '/login';
    }
  };

  // Return both shapes so callers can use either:
  //   const { logout } = useLogout()   ← object destructure
  //   const logout = useLogout()        ← direct call (wrong usage, but handled)
  return { logout: handleLogout };
}
