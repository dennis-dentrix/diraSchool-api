'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { label: 'Overview', href: '/fees' },
  { label: 'Fee Structures', href: '/fees/structures' },
  { label: 'Payments', href: '/fees/payments' },
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
            return (
              <Link
                key={item.href}
                href={item.href}
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

