'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { settingsApi, dashboardApi, notificationsApi } from '@/lib/api';
import { schoolNavItems, superadminNavItems } from '@/components/layout/nav-items';
import { Skeleton } from '@/components/ui/skeleton';
import { TourProvider } from '@/components/tour/TourProvider';
import { TourBanner } from '@/components/tour/TourTrigger';

const ADMIN_ROLES = ['school_admin', 'director', 'headteacher', 'deputy_headteacher', 'accountant', 'secretary'];

function getPageTitle(pathname, user) {
  const allItems = user?.role === 'superadmin' ? superadminNavItems : schoolNavItems;
  const match = allItems.find((item) =>
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href) && item.href !== '/dashboard',
  );
  return match?.label ?? 'Dashboard';
}

function calcTermWeeks(term) {
  if (!term?.startDate || !term?.endDate) return { week: null, total: null };
  const start = new Date(term.startDate);
  const end = new Date(term.endDate);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const total = Math.max(1, Math.ceil((end - start) / msPerWeek));
  const week = Math.min(total, Math.max(1, Math.ceil((now - start) / msPerWeek)));
  return { week, total };
}

export default function DashboardLayout({ children }) {
  const { user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname, user);
  const schoolName = user?.school?.name ?? (typeof user?.schoolId === 'object' ? user?.schoolId?.name : '');
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const { data: settingsData } = useQuery({
    queryKey: ['header-settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      return res.data?.settings ?? res.data?.data ?? res.data;
    },
    enabled: !!user && user?.role !== 'superadmin',
    staleTime: 60 * 1000,
  });

  // Badge counts — share cache key with dashboard page
  const { data: dashSummary } = useQuery({
    queryKey: ['dashboard-summary', user?.role],
    queryFn: async () => {
      const res = await dashboardApi.get();
      return res.data?.summary ?? res.data?.data ?? res.data;
    },
    enabled: !!isAdmin,
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return res.data?.count ?? res.data?.data?.count ?? 0;
    },
    enabled: !!user && user?.role !== 'superadmin',
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const badges = useMemo(() => {
    const studentsOverdue = dashSummary?.fees?.studentsOverdue ?? dashSummary?.fees?.studentsToFollowUp;
    const activeStudents = dashSummary?.students?.byStatus?.active ?? dashSummary?.students?.total;
    const msgCount = notifData ?? 0;
    const b = {};
    if (studentsOverdue > 0)  b['/fees']      = studentsOverdue;
    if (activeStudents > 0)   b['/students']  = activeStudents;
    if (msgCount > 0)         b['/messaging'] = msgCount;
    return b;
  }, [dashSummary, notifData]);

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

  const isMidterm = todayHoliday && /mid\s*term/i.test(`${todayHoliday.name ?? ''} ${todayHoliday.description ?? ''}`);
  const previousTerm = [...terms]
    .filter((t) => String(t?.endDate ?? '').slice(0, 10) < todayIso)
    .sort((a, b) => String(b?.endDate ?? '').localeCompare(String(a?.endDate ?? '')))[0];

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

  // Look ahead 1 day for "Holiday tomorrow"
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const tomorrowHoliday = holidays.find((h) => String(h?.date ?? '').slice(0, 10) === tomorrowIso);

  const termLabel = currentTerm
    ? `${currentTerm.name}${currentAcademicYear ? ` · ${currentAcademicYear}` : ''}`
    : (currentAcademicYear ? `Academic Year ${currentAcademicYear}` : null);

  const { week: termWeek, total: termTotalWeeks } = calcTermWeeks(currentTerm);
  const termProgressPct = termWeek && termTotalWeeks ? Math.round((termWeek / termTotalWeeks) * 100) : null;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (!isLoading && user?.role === 'parent') {
      router.replace('/portal');
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden lg:flex flex-col h-full w-64 shrink-0 border-r bg-sidebar p-4 gap-4">
          <div className="flex items-center gap-3 px-1 py-3 border-b border-sidebar-border mb-1">
            <Skeleton className="h-9 w-9 rounded-xl bg-white/10" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-full bg-white/10" />
              <Skeleton className="h-2.5 w-14 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="space-y-1 flex-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="h-4 w-4 rounded bg-white/10 shrink-0" />
                <Skeleton className="h-3 rounded-full bg-white/10" style={{ width: `${60 + (i * 13) % 50}px` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 px-2 py-2 border-t border-sidebar-border">
            <Skeleton className="h-8 w-8 rounded-full bg-white/10 shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-24 rounded-full bg-white/10" />
              <Skeleton className="h-2 w-16 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="h-12 border-b flex items-center gap-4 px-6 shrink-0">
            <Skeleton className="h-4 w-32 rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex-1 p-6 space-y-6">
            <div className="space-y-1">
              <Skeleton className="h-6 w-40 rounded-full" />
              <Skeleton className="h-3.5 w-64 rounded-full" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-5 space-y-3">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-2.5 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TourProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <NavigationProgress />
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <Sidebar user={user} badges={badges} />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar user={user} badges={badges} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header
            onMenuClick={() => setMobileOpen(true)}
            title={title}
            schoolName={schoolName}
            termLabel={termLabel}
            termWeek={termWeek}
            termTotalWeeks={termTotalWeeks}
            termProgressPct={termProgressPct}
            schoolDayStatus={schoolDayStatus}
            tomorrowHoliday={tomorrowHoliday}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
            <div className="space-y-4 sm:space-y-5">
              <TourBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </TourProvider>
  );
}
