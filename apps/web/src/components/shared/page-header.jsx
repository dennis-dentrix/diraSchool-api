import { cn } from '@/lib/utils';

export function PageHeader({ title, description, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6', className)}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">{children}</div>}
    </div>
  );
}
