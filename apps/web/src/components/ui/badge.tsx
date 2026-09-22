import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// uiverse.io returns 403 to WebFetch in this environment (confirmed
// 2026-09-24, same block documented in TRACKER.md Phase 0.6) — built as a
// deliberate, token-driven primitive rather than an adaptation. Monochrome
// per CLAUDE.md §12a: THEN/ELSE are distinguished by fill vs. outline, not
// by hue.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        solid: 'bg-accent text-accent-foreground',
        outline: 'border border-border text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
