import Link from 'next/link';
import { Logo } from './logo';
import { WordmarkGlow } from './wordmark-glow';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/features/comment-to-dm', label: 'Comment to DM' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/data-deletion', label: 'Data deletion' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              Automate Instagram comment replies and DMs. Built by Orincore.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{column.heading}</h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Orincore. All rights reserved.</p>
          <a href="mailto:support@orincore.com" className="hover:text-foreground">
            support@orincore.com
          </a>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl px-4 pb-6 sm:px-6">
        <WordmarkGlow word="Convozy" />
      </div>
    </footer>
  );
}
