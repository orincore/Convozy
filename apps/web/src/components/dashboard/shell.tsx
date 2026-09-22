'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SignOut } from '@phosphor-icons/react';
import { clearTokens } from '@/lib/auth';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/app', label: 'Accounts' },
  { href: '/app/automations', label: 'Automations' },
  { href: '/app/activity', label: 'Activity' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    clearTokens();
    router.replace('/app/login');
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/app" className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <span className="text-sm font-bold">C</span>
              </div>
              <span className="text-base font-semibold tracking-tight">Convozy</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive(pathname, item.href)
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <SignOut size={16} weight="bold" />
            Log out
          </button>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-3 sm:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(pathname, item.href)
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
