'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { schoolNavItems, superadminNavItems } from './nav-items';

function buildBreadcrumbs(pathname, isSuperAdmin) {
  const nav = isSuperAdmin ? superadminNavItems : schoolNavItems;
  const top = nav.find((item) =>
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  if (!top) return [];
  const crumbs = [{ label: top.label, href: top.href }];

  if (Array.isArray(top.children)) {
    const child = top.children.find((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
    if (child) crumbs.push({ label: child.label, href: child.href });
  }

  return crumbs;
}

export function Breadcrumbs({ user }) {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname, user?.role === 'superadmin');
  if (!crumbs.length) return null;

  return (
    <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <div key={crumb.href} className="flex items-center gap-1.5">
            {isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
            {!isLast && <ChevronRight className="h-3 w-3" />}
          </div>
        );
      })}
    </nav>
  );
}

