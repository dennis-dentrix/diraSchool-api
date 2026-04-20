'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { settingsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function ParentLayout({ children }) {
  const { user, isLoading } = useAuth();
  const { logout } = useLogout();
  const router = useRouter();
  const schoolName = user?.school?.name ?? (typeof user?.schoolId === 'object' ? user?.schoolId?.name : '');

  const { data: settingsData } = useQuery({
    queryKey: ['parent-header-settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      return res.data?.settings ?? res.data?.data ?? res.data;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const terms = settingsData?.terms ?? [];
  const holidays = settingsData?.holidays ?? [];
  const currentAcademicYear = settingsData?.currentAcademicYear;

  const currentTerm = terms.find((t) => {
    const start = String(t?.startDate ?? '').slice(0, 10);
    const end = String(t?.endDate ?? '').slice(0, 10);
    return start && end && todayIso >= start && todayIso <= end;
  });

  const todayHoliday = holidays.find((h) => String(h?.date ?? '').slice(0, 10) === todayIso);
  const nextTerm = [...terms]
    .filter((t) => String(t?.startDate ?? '').slice(0, 10) > todayIso)
    .sort((a, b) => String(a?.startDate ?? '').localeCompare(String(b?.startDate ?? '')))[0];
  const previousTerm = [...terms]
    .filter((t) => String(t?.endDate ?? '').slice(0, 10) < todayIso)
    .sort((a, b) => String(b?.endDate ?? '').localeCompare(String(a?.endDate ?? '')))[0];

  const isMidterm = todayHoliday && /mid\s*term/i.test(`${todayHoliday.name ?? ''} ${todayHoliday.description ?? ''}`);

  const formatIso = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value).slice(0, 10);
    return dt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  };

  const breakWindow = (!currentTerm && nextTerm && previousTerm)
    ? `${formatIso(previousTerm.endDate)} - ${formatIso(nextTerm.startDate)}`
    : null;

  const schoolDayStatus = todayHoliday
    ? (isMidterm ? `Midterm break: ${todayHoliday.name}` : `Holiday: ${todayHoliday.name}`)
    : (!currentTerm && nextTerm
      ? `On break${breakWindow ? ` (${breakWindow})` : ''} · Next term starts ${formatIso(nextTerm.startDate)}`
      : null);

  const termLabel = currentTerm
    ? `${currentTerm.name}${currentAcademicYear ? ` · ${currentAcademicYear}` : ''}`
    : (currentAcademicYear ? `Academic Year ${currentAcademicYear}` : null);

  useEffect(() => {
    if (!isLoading && user && user.role !== 'parent') {
      router.replace('/dashboard');
    }
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  if (!user || user.role !== 'parent') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="font-semibold text-sm">Diraschool Parent Portal</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.firstName} {user.lastName}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        {(schoolName || termLabel || schoolDayStatus) && (
          <div className="max-w-4xl mx-auto px-4 pb-2.5">
            <p className="text-xs text-muted-foreground truncate">
              {schoolName}
              {schoolName && termLabel ? ' · ' : ''}
              {termLabel}
              {(schoolName || termLabel) && schoolDayStatus ? ' · ' : ''}
              {schoolDayStatus}
            </p>
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}
