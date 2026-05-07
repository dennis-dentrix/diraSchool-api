import { cn } from '@/lib/utils';

/**
 * Page-level header used at the top of every list/detail page.
 *
 * Props:
 *   overline  – small-caps label above the title (e.g. "Students · 142 active")
 *   title     – main heading (font-display, h1 by default)
 *   description – optional sub-text line
 *   as        – element type override (default "h1")
 *   children  – action buttons / controls rendered on the right
 */
export function PageHeader({ overline, title, description, children, className, as: Heading = 'h1' }) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {overline && (
          <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground mb-0.5 leading-none">
            {overline}
          </p>
        )}
        <Heading className="font-display text-xl font-semibold text-foreground tracking-tight break-words">
          {title}
        </Heading>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 mt-1 sm:mt-0">
          {children}
        </div>
      )}
    </div>
  );
}
