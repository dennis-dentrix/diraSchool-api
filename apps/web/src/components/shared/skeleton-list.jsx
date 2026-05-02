import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders N stacked skeleton rows — replaces the repeated
 * Array.from({ length: N }).map(() => <Skeleton />) pattern.
 */
export function SkeletonList({ count = 5, className = 'h-12 w-full rounded-lg', spacing = 'space-y-2' }) {
  return (
    <div className={spacing}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
