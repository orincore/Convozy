import Link from 'next/link';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/features/comment-to-dm', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
];

/** Single-line nav, height capped well under 80px (taste-skill 4.7). */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"
      >
        <Logo />

        <ul className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href="/app/login"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Log in
          </Link>
          <Button asChild size="sm">
            <Link href="/app/login">Start free</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
