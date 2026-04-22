import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isLoading: false }),
    }),
    {
      name: 'diraschool-auth',
      version: 2,
      partialize: (state) => ({ user: state.user }),
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        const next = { ...persistedState };
        if (next.user && typeof next.user === 'object' && next.user.user) {
          next.user = next.user.user;
        }
        return next;
      },
    },
  ),
);

export function isAdmin(user) {
  if (!user) return false;
  return ['school_admin', 'director', 'headteacher', 'deputy_headteacher'].includes(user.role);
}

export function isSuperAdmin(user) {
  return user?.role === 'superadmin';
}

export function isParent(user) {
  return user?.role === 'parent';
}

export function isTeacher(user) {
  return ['teacher', 'department_head'].includes(user?.role);
}

export function canAccess(user, roles) {
  if (!user) return false;
  return roles.includes(user.role);
}
