import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StatCard({ title, value, description, icon: Icon, trend, color = 'blue', loading, onClick, actionLabel = 'View details' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const interactive = typeof onClick === 'function';

  return (
    <Card className={cn(interactive && 'transition-shadow hover:shadow-md')}>
      <CardContent className={cn('pt-6', interactive && 'p-0')}>
        <div
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={interactive ? onClick : undefined}
          onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick?.() : undefined}
          className={cn(interactive && 'w-full p-6 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
          aria-label={interactive ? `${title} - ${actionLabel}` : undefined}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold">{value ?? '—'}</p>
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            {Icon && (
              <div className={cn('p-2.5 rounded-lg', colorMap[color])}>
                <Icon className="h-5 w-5" />
              </div>
            )}
          </div>
          {trend != null && (
            <div className="mt-3 flex items-center gap-1">
              <span className={cn('text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-xs text-muted-foreground">vs last term</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
