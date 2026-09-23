import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';

/**
 * Pill CTA with a nested trailing icon circle (button-in-button). On hover
 * the icon slides diagonally; on press the whole pill compresses.
 */
export function CtaButton({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
}) {
  const primary = variant === 'primary';
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-3 whitespace-nowrap rounded-full py-2 pl-6 pr-2 text-[0.9375rem] font-medium transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        primary
          ? 'cta-glow bg-accent text-accent-foreground'
          : 'border border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08]',
        className,
      )}
    >
      {children}
      <span
        className={cn(
          'grid size-9 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-1 group-hover:scale-105',
          primary ? 'bg-accent-foreground/10' : 'bg-white/10',
        )}
      >
        <ArrowUpRight size={16} weight="bold" />
      </span>
    </Link>
  );
}
