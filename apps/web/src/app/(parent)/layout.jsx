'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Home, LogOut } from 'lucide-react';

function NavLink({ href, children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = href.split('?tab=')[1];
  const activeTab = searchParams.get('tab') || 'fees';
  const isActive = pathname === '/portal' && target ? activeTab === target : pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      {children}
    </Link>
  );
}

export default function ParentLayout({ children }) {
  const { user, isLoading } = useAuth();
  const { logout } = useLogout();
  const router = useRouter();

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
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
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
        <div className="max-w-4xl mx-auto px-4 pb-3 overflow-x-auto">
          <nav className="flex items-center gap-2 min-w-max">
            <NavLink href="/portal?tab=fees"><Home className="h-4 w-4" />Fees</NavLink>
            <NavLink href="/portal?tab=attendance">Attendance</NavLink>
            <NavLink href="/portal?tab=results">Results</NavLink>
            <NavLink href="/portal?tab=reports">Report Cards</NavLink>
            <NavLink href="/portal?tab=school">School Info</NavLink>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}
