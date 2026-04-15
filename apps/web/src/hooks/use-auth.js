'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!queryLoading) {
      setUser(data ?? null);
    } else {
      setLoading(true);
    }
  }, [data, queryLoading, setUser, setLoading]);

  return {
    user: user ?? data ?? null,
    isLoading: queryLoading || isLoading,
    isAuthenticated: !!(user ?? data),
  };
}

export function useLogout() {
  const { logout } = useAuthStore();

  return async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      logout();
      window.location.href = '/login';
    }
  };
}
