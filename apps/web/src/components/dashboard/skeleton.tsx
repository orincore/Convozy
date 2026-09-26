import { cn } from '@/lib/cn';

// Adapted from Spectrum UI's Skeleton Reveal (spectrumhq.in/docs/skeleton-reveal):
// same pulse-in-place technique (opacity keyframe, reduced-motion off),
// simplified to a single bar primitive so each page composes its own
// loading shape instead of a generic centered spinner.
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'block animate-pulse rounded-[var(--radius-control)] bg-muted motion-reduce:animate-none',
        className,
      )}
      aria-hidden
    />
  );
}

export function AccountRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <SkeletonBar className="size-9 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <SkeletonBar className="h-3.5 w-32" />
          <SkeletonBar className="h-3 w-24" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SkeletonBar className="h-5 w-16 rounded-full" />
        <SkeletonBar className="size-8 rounded-[var(--radius-control)]" />
        <SkeletonBar className="size-8 rounded-[var(--radius-control)]" />
      </div>
    </div>
  );
}

export function AutomationRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <SkeletonBar className="h-3.5 w-40" />
        <SkeletonBar className="h-3 w-28" />
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <SkeletonBar className="h-6 w-16 rounded-full" />
        <SkeletonBar className="h-6 w-10 rounded-full" />
        <SkeletonBar className="size-8 rounded-[var(--radius-control)]" />
        <SkeletonBar className="size-8 rounded-[var(--radius-control)]" />
      </div>
    </div>
  );
}
