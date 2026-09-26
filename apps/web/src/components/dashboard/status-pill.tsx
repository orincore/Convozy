import type { Icon } from '@phosphor-icons/react';
import { CheckCircle, CircleNotch, LinkBreak, PauseCircle, PencilSimple, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';

export type PillTone = 'success' | 'danger' | 'warning' | 'neutral';

const TONE_CLASS: Record<PillTone, string> = {
  success: 'bg-success/10 text-success ring-success/25',
  danger: 'bg-danger/10 text-danger ring-danger/25',
  warning: 'bg-amber-400/10 text-amber-300 ring-amber-300/25',
  neutral: 'bg-muted text-muted-foreground ring-border',
};

// Adapted from Spectrum UI's Status Badge (spectrumhq.in/docs/status-badge):
// kept the ring-inset pill shape and spin-on-progress affordance, remapped
// its hue-per-state palette onto the locked monochrome tokens (only
// success/danger carry real color, per CLAUDE.md §12a).
export function StatusPill({
  label,
  tone,
  icon: Icon,
  spin = false,
  className,
}: {
  label: string;
  tone: PillTone;
  icon?: Icon;
  spin?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ring-1 ring-inset',
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && (
        <Icon
          size={12}
          weight="bold"
          className={cn(spin && 'animate-spin motion-reduce:animate-none')}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}

export const STATUS_PILL = {
  ACTIVE: { label: 'Active', tone: 'success' as const, icon: CheckCircle },
  RATE_LIMITED: { label: 'Rate limited', tone: 'warning' as const, icon: WarningCircle },
  TOKEN_EXPIRED: { label: 'Reconnect needed', tone: 'danger' as const, icon: LinkBreak },
  DISCONNECTED: { label: 'Disconnected', tone: 'neutral' as const, icon: LinkBreak },
  ERROR: { label: 'Error', tone: 'danger' as const, icon: WarningCircle },
  SYNCING: { label: 'Syncing', tone: 'neutral' as const, icon: CircleNotch },
  PAUSED: { label: 'Paused', tone: 'neutral' as const, icon: PauseCircle },
  DRAFT: { label: 'Draft', tone: 'neutral' as const, icon: PencilSimple },
};
