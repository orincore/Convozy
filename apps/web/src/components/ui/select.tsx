import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// Promoted from the inline-styled native <select> pattern already used
// throughout the automation builder (see automations/new/page.tsx) into a
// reusable primitive, rather than a uiverse.io adaptation — uiverse.io
// returns 403 to WebFetch in this environment (confirmed 2026-09-24, same
// as the earlier documented block in TRACKER.md Phase 0.6), so this follows
// the established fallback of a deliberate, token-driven bespoke component.
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 rounded-[var(--radius-control)] border border-border bg-background px-2.5 text-sm text-foreground transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
