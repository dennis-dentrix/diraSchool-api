import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Empty / zero-state placeholder.
 * Design rule: icon is rendered outline at muted opacity — no filled circle background.
 */
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center px-4', className)}>
      {Icon && (
        <Icon className="h-10 w-10 text-muted-foreground/40 mb-4" strokeWidth={1.25} aria-hidden />
      )}
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
