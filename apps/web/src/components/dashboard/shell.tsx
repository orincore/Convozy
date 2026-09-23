'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SignOut,
  List,
  X,
  InstagramLogo,
  Lightning,
  UsersThree,
  FunnelSimple,
  Tag,
  SlidersHorizontal,
  Pulse,
} from '@phosphor-icons/react';
import { clearTokens } from '@/lib/auth';
import { cn } from '@/lib/cn';

interface NavLink {
  href: string;
  label: string;
  icon: typeof Lightning;
}

interface NavGroup {
  label: string;
  items: NavLink[];
}

// Restructured from a single-row pill nav into a grouped sidebar (Milestone
// 2, MANYCHAT_FEATURE_AUDIT.md-driven build): 3 flat items overflowed once
// Contacts/Segments/Tags/Custom Fields landed. Groups mirror ui.md §1's
// ManyChat page inventory (Automate/Audience/Insights) — only sections with
// pages that actually exist today are listed; Growth/Broadcasts/Analytics
// join their groups once those milestones ship, not before.
const STANDALONE: NavLink = { href: '/app', label: 'Accounts', icon: InstagramLogo };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Automate',
    items: [{ href: '/app/automations', label: 'Automations', icon: Lightning }],
  },
  {
    label: 'Audience',
    items: [
      { href: '/app/contacts', label: 'Contacts', icon: UsersThree },
      { href: '/app/segments', label: 'Segments', icon: FunnelSimple },
      { href: '/app/tags', label: 'Tags', icon: Tag },
      { href: '/app/custom-fields', label: 'Custom fields', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Insights',
    items: [{ href: '/app/activity', label: 'Activity', icon: Pulse }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname.startsWith(href);
}

function NavItem({ item, pathname, onNavigate }: { item: NavLink; pathname: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <Icon size={17} weight={active ? 'fill' : 'regular'} />
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="flex items-center justify-between px-2">
        <Link href="/app" className="flex items-center gap-2 text-foreground" onClick={onNavigate}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <span className="text-sm font-bold">C</span>
          </div>
          <span className="text-base font-semibold tracking-tight">Convozy</span>
        </Link>
        {onNavigate && (
          <button type="button" onClick={onNavigate} className="text-muted-foreground sm:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        <NavItem item={STANDALONE} pathname={pathname} onNavigate={onNavigate} />
      </nav>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            {group.label}
          </span>
          <nav className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    clearTokens();
    router.replace('/app/login');
  }

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="hidden w-60 shrink-0 border-r border-border sm:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/80"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-background">
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-[100dvh] flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="text-foreground sm:hidden"
            aria-label="Open menu"
          >
            <List size={22} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <SignOut size={16} weight="bold" />
            Log out
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
