import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';

const CLASSES = (primary: boolean, className?: string) =>
  cn(
    'group inline-flex items-center gap-3 whitespace-nowrap rounded-full py-2 pl-6 pr-2 text-[0.9375rem] font-medium transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    primary
      ? 'cta-glow bg-accent text-accent-foreground'
      : 'border border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08]',
    className,
  );

function TrailingIcon({ primary }: { primary: boolean }) {
  return (
    <span
      className={cn(
        'grid size-9 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-1 group-hover:scale-105',
        primary ? 'bg-accent-foreground/10' : 'bg-white/10',
      )}
    >
      <ArrowUpRight size={16} weight="bold" />
    </span>
  );
}

interface CtaButtonBaseProps {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
}

/**
 * Pill CTA with a nested trailing icon circle (button-in-button). On hover
 * the icon slides diagonally; on press the whole pill compresses. Renders a
 * `<Link>` when given `href` (marketing pages), or a real `<button>` when
 * given `onClick` (in-app actions like starting an OAuth redirect) - same
 * look, correct semantics either way.
 */
export function CtaButton(
  props: CtaButtonBaseProps &
    ({ href: string; onClick?: never; disabled?: never } | { href?: never; onClick: () => void; disabled?: boolean }),
) {
  const { children, variant = 'primary', className } = props;
  const primary = variant === 'primary';

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={CLASSES(primary, className)}>
        {children}
        <TrailingIcon primary={primary} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={CLASSES(primary, className)}
    >
      {children}
      <TrailingIcon primary={primary} />
    </button>
  );
}
