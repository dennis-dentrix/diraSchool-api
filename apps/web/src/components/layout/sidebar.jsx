'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { schoolNavGroups, superadminNavItems } from './nav-items';
import { BrandLogo } from '@/components/shared/brand-logo';

const NAV_TOUR_ATTRS = {
  '/dashboard':   'dashboard-nav-item',
  '/students':    'students-nav-item',
  '/staff':       'staff-nav-item',
  '/fees':        'finance-nav',
  '/attendance':  'attendance-nav-item',
  '/exams':       'exams-nav-item',
  '/leave':       'leave-nav-item',
  '/timetable':   'timetable-nav-item',
  '/messaging':   'messaging-nav-item',
  '/settings':    'settings-nav-item',
  '/users':       'users-nav-item',
};

function NavItem({ item, pathname, onNavigate, badge }) {
  const isActive =
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href);

  const hasChildren = item.children?.length > 0;
  const tourAttr = NAV_TOUR_ATTRS[item.href];
  const displayBadge = badge ?? item.badge;

  const baseClasses = 'group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100';
  const activeClasses = 'bg-white/[0.08] text-white';
  const inactiveClasses = 'text-white/60 hover:text-white hover:bg-white/[0.08]';

  if (hasChildren) {
    return (
      <div>
        <Link
          href={item.href}
          data-tour={tourAttr}
          onClick={onNavigate}
          className={cn(baseClasses, isActive ? activeClasses : inactiveClasses)}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
          )}
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {displayBadge != null && (
            <span className="font-mono text-[10px] tabular-nums bg-white/10 text-white/70 rounded px-1.5 py-0.5 leading-none mr-1">
              {displayBadge}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform duration-200', isActive && 'rotate-180')} />
        </Link>
        {isActive && (
          <div className="ml-7 mt-0.5 mb-1 space-y-0.5 border-l border-white/10 pl-3">
            {item.children.map((child) => {
              const childActive =
                child.href === item.href
                  ? pathname === child.href
                  : pathname === child.href || pathname.startsWith(child.href + '/');
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'block px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                    childActive
                      ? 'text-white bg-white/10'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.08]',
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      data-tour={tourAttr}
      onClick={onNavigate}
      className={cn(baseClasses, isActive ? activeClasses : inactiveClasses)}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
      )}
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {displayBadge != null && (
        <span className="font-mono text-[10px] tabular-nums bg-white/10 text-white/70 rounded px-1.5 py-0.5 leading-none">
          {displayBadge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ user, onNavigate, badges = {} }) {
  const pathname = usePathname();

  const isSuperAdmin = user?.role === 'superadmin';

  const navGroups = isSuperAdmin
    ? [{ group: null, items: superadminNavItems }]
    : schoolNavGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => item.roles?.includes(user?.role)),
        }))
        .filter((g) => g.items.length > 0);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;
  const schoolName = user?.school?.name ?? (typeof user?.schoolId === 'object' ? user?.schoolId?.name : '');

  return (
    <div className="flex flex-col h-full bg-sidebar w-64 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <BrandLogo className="w-9 h-9 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight tracking-tight">Diraschool</p>
          <p className="text-white/55 text-xs mt-0.5 truncate max-w-[140px]">
            {isSuperAdmin ? 'Super Admin' : (schoolName || 'School Portal')}
          </p>
        </div>
        {/* Close button — mobile only (onNavigate is only passed in the Sheet) */}
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="ml-auto p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-2">
        <nav>
          {navGroups.map(({ group, items }) => (
            <div key={group ?? '_root'}>
              {group && (
                <p className="text-[9.5px] uppercase tracking-[0.16em] text-white/30 px-3 pt-4 pb-1 first:pt-2 select-none">
                  {group}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    badge={badges[item.href]}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 transition-colors cursor-default">
          <div className="relative shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold ring-2 ring-white/10">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-sidebar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-white/55 text-xs truncate capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
