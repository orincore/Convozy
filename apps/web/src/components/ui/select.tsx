import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// Promoted from the inline-styled native <select> pattern already used
// throughout the automation builder (see automations/new/page.tsx) into a
// reusable primitive, rather than a uiverse.io adaptation — uiverse.io
// returns 403 to WebFetch in this environment (confirmed 2026-09-24, same
// as the earlier documented block in TRACKER.md Phase 0.6), so this follows
// the established fallback of a deliberate, token-driven bespoke component.
const CARET =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='%23a1a1aa'%3E%3Cpath d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E\")";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 appearance-none rounded-[var(--radius-control)] border border-border bg-background bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pl-2.5 pr-8 text-sm text-foreground transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent disabled:opacity-50',
        className,
      )}
      style={{ backgroundImage: CARET, ...props.style }}
      {...props}
    >
      {children}
    </select>
  );
}
