import { cn } from '@/lib/utils';

export function SectionCard({ title, icon: Icon, action, children, className }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 md:px-6 py-2 sm:py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        {action}
      </div>
      <div className="p-3 sm:p-4 md:p-6">{children}</div>
    </div>
  );
}
