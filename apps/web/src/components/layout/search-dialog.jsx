'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard',      href: '/dashboard'       },
  { label: 'Students',       href: '/students'        },
  { label: 'Attendance',     href: '/attendance'      },
  { label: 'Fee Payments',   href: '/fees/payments'   },
  { label: 'Fee Overview',   href: '/fees'            },
  { label: 'Fee Structures', href: '/fees/structures' },
  { label: 'Staff',          href: '/staff'           },
  { label: 'Messaging',      href: '/messaging'       },
  { label: 'Timetable',      href: '/timetable'       },
  { label: 'Leave',          href: '/leave'           },
  { label: 'Classes',        href: '/classes'         },
  { label: 'Subjects',       href: '/subjects'        },
  { label: 'Exams',          href: '/exams'           },
  { label: 'Lesson Plans',   href: '/lesson-plans'    },
  { label: 'Transport',      href: '/transport'       },
  { label: 'Settings',       href: '/settings'        },
  { label: 'Audit Logs',     href: '/audit-logs'      },
  { label: 'Billing',        href: '/billing'         },
];

export function SearchDialog({ open, onOpenChange }) {
  const [query, setQuery]         = useState('');
  const [activeIndex, setActive]  = useState(0);
  const router   = useRouter();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // slight delay so the Dialog animation doesn't steal focus
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open]);

  const filtered = query.trim()
    ? NAV_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.href.includes(query.toLowerCase()),
      )
    : NAV_ITEMS;

  useEffect(() => setActive(0), [query]);

  const navigate = (href) => {
    router.push(href);
    onOpenChange(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered.length > 0) navigate(filtered[activeIndex]?.href ?? filtered[0].href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md gap-0 overflow-hidden" aria-label="Search navigation">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-border px-4 h-12 shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, fees, students…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="font-mono text-[10px] tabular-nums text-muted-foreground border border-border rounded px-1.5 py-0.5 leading-none shrink-0">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  i === activeIndex ? 'bg-muted' : 'hover:bg-muted/50',
                )}
              >
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
