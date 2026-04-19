'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { schoolNavItems, superadminNavItems } from '@/components/layout/nav-items';
import { Skeleton } from '@/components/ui/skeleton';

function getPageTitle(pathname, user) {
  const allItems = user?.role === 'superadmin' ? superadminNavItems : schoolNavItems;
  const match = allItems.find((item) =>
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href) && item.href !== '/dashboard',
  );
  return match?.label ?? 'Dashboard';
}

export default function DashboardLayout({ children }) {
  const { user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname, user);
  const schoolName = user?.school?.name ?? (typeof user?.schoolId === 'object' ? user?.schoolId?.name : '');

  // Guard: redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar skeleton */}
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
        {/* Main content skeleton */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b flex items-center gap-4 px-6 shrink-0">
            <Skeleton className="h-4 w-32 rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          {/* Content */}
          <div className="flex-1 p-6 space-y-6">
            <div className="space-y-1">
              <Skeleton className="h-6 w-40 rounded-full" />
              <Skeleton className="h-3.5 w-64 rounded-full" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-5 space-y-3">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-2.5 w-24 rounded-full" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border overflow-hidden">
              <div className="p-4 border-b"><Skeleton className="h-4 w-24 rounded-full" /></div>
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavigationProgress />
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar user={user} />
      </div>

      {/* Mobile sidebar (sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar user={user} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} title={title} schoolName={schoolName} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {schoolName && user?.role !== 'superadmin' && (
            <p className="text-xs text-muted-foreground mb-3">{schoolName}</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
