import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// tone → accent-bar color. Also accepts legacy `color` prop mapped below.
const TONE_BAR = {
  blue:    'bg-primary',
  green:   'bg-ok',
  red:     'bg-bad',
  rose:    'bg-bad',
  amber:   'bg-warn',
  orange:  'bg-warn',
  yellow:  'bg-warn',
  purple:  'bg-primary/70',
  violet:  'bg-primary/70',
  neutral: 'bg-border',
};

// Legacy color → tone mapping so existing callers keep working
const COLOR_TO_TONE = {
  blue:   'blue',
  green:  'green',
  red:    'red',
  purple: 'purple',
  orange: 'amber',
  yellow: 'amber',
};

export function StatCard({
  // New-style props
  label,
  value,
  hint,
  tone,
  badge,
  // Legacy props (kept for backward compatibility)
  title,
  description,
  icon: Icon,
  trend,
  color,
  loading,
  onClick,
  actionLabel = 'View details',
  className,
}) {
  const resolvedLabel = label ?? title;
  const resolvedHint  = hint  ?? description;
  const resolvedTone  = tone  ?? (color ? COLOR_TO_TONE[color] : 'neutral') ?? 'neutral';
  const bar           = TONE_BAR[resolvedTone] ?? 'bg-border';
  const interactive   = typeof onClick === 'function';

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4 space-y-3', className)}>
        <Skeleton className="h-2.5 w-20 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-2.5 w-24 rounded-full" />
      </div>
    );
  }

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick?.() : undefined}
      aria-label={interactive ? `${resolvedLabel} — ${actionLabel}` : undefined}
      className={cn(
        'relative rounded-lg border border-border bg-card p-4 overflow-hidden',
        interactive && 'cursor-pointer hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {/* Accent left bar */}
      <span className={cn('absolute left-0 inset-y-0 w-[3px] rounded-l-lg', bar)} />

      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground leading-none">
          {resolvedLabel}
        </p>
        {(badge != null || Icon) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            {badge != null && (
              <span className="font-mono text-[10px] tabular-nums bg-muted text-muted-foreground rounded px-1.5 py-0.5 leading-none">
                {badge}
              </span>
            )}
          </div>
        )}
      </div>

      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground leading-none">
        {value ?? '—'}
      </p>

      {resolvedHint && (
        <p className="mt-1.5 text-xs text-muted-foreground">{resolvedHint}</p>
      )}

      {trend != null && (
        <div className="mt-2 flex items-center gap-1">
          <span className={cn('text-xs font-medium font-mono tabular-nums', trend >= 0 ? 'text-ok' : 'text-bad')}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-xs text-muted-foreground">vs last term</span>
        </div>
      )}
    </div>
  );
}
