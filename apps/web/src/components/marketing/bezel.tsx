import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Double-bezel container: a hairline outer shell holding an inner core with
 * its own inset highlight and a concentric, smaller radius (soft-skill 4.A).
 */
export function Bezel({
  children,
  className,
  coreClassName,
}: {
  children: ReactNode;
  className?: string;
  coreClassName?: string;
}) {
  return (
    <div className={cn('rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5', className)}>
      <div
        className={cn(
          'h-full rounded-[calc(2rem-0.375rem)] bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]',
          coreClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
