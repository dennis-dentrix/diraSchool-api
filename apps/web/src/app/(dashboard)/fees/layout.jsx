'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { label: 'Payments',       href: '/fees/payments',   tour: 'todays-collections-tab' },
  { label: 'Overview',       href: '/fees',            tour: undefined },
  { label: 'Fee Structures', href: '/fees/structures', tour: 'fee-structure-nav' },
];

export default function FeesLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <div className="flex border-b">
        {ITEMS.map((item) => {
          const isActive = item.href === '/fees'
            ? pathname === '/fees'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
