'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Ordered by daily-use frequency: Payments (daily) → Overview (summary) → Fee Structures (setup)
const ITEMS = [
  { label: 'Payments',       href: '/fees/payments'   },
  { label: 'Overview',       href: '/fees'            },
  { label: 'Fee Structures', href: '/fees/structures' },
];

export default function FeesLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-1 bg-muted/40">
        <div className="flex flex-wrap gap-1">
          {ITEMS.map((item) => {
            const isActive =
              item.href === '/fees'
                ? pathname === '/fees'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const tourAttr =
              item.href === '/fees/structures' ? 'fee-structure-nav' :
              item.href === '/fees/payments'   ? 'todays-collections-tab' :
              undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={tourAttr}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  isActive
                    ? 'bg-background border text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}

