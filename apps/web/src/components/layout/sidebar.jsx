'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { schoolNavItems, superadminNavItems } from './nav-items';

function NavItem({ item, pathname }) {
  const isActive =
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-900/60'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.08]',
      )}
    >
      <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-150', !isActive && 'group-hover:scale-110')} />
      <span>{item.label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
    </Link>
  );
}

export function Sidebar({ user }) {
  const pathname = usePathname();

  const isSuperAdmin = user?.role === 'superadmin';
  const navItems = isSuperAdmin
    ? superadminNavItems
    : schoolNavItems.filter((item) => item.roles?.includes(user?.role));

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <div className="flex flex-col h-full bg-sidebar w-64 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shrink-0 shadow-lg shadow-blue-900/50">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight tracking-tight">Diraschool</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {isSuperAdmin ? 'Super Admin' : 'School Portal'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-default">
          <div className="relative shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold ring-2 ring-white/10">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-sidebar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-slate-500 text-xs truncate capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
