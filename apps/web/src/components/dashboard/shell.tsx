'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
  SidebarSimple,
  CircleNotch,
  Ticket,
  UsersFour,
  Gear,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import { clearTokens } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { DashboardBackdrop } from './backdrop';
import { AccountProvider, useAccounts } from './account-context';
import { AccountSwitcher } from './account-switcher';

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
    label: 'Support',
    items: [
      { href: '/app/tickets', label: 'Tickets', icon: Ticket },
      { href: '/app/settings/tickets', label: 'Ticket rules', icon: Gear },
    ],
  },
  {
    label: 'Insights',
    items: [{ href: '/app/activity', label: 'Activity', icon: Pulse }],
  },
  {
    label: 'Workspace',
    items: [{ href: '/app/settings/team', label: 'Team', icon: UsersFour }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname.startsWith(href);
}

// Adapted from Spectrum UI's Nav List Card (spectrumhq.in/docs/nav-list-card):
// kept the spring hover-slide on the label, replaced its static highlight
// with a shared `layoutId` pill that glides between items on route change,
// and swapped lucide-react for Phosphor + our token colors.
function NavItem({
  item,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  item: NavLink;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const reduce = useReducedMotion();

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'relative flex items-center gap-2.5 rounded-[var(--radius-control)] py-2 text-sm font-medium',
        collapsed ? 'justify-center px-0' : 'px-3',
      )}
    >
      {active && (
        <motion.span
          layoutId="dashboard-nav-active"
          className="absolute inset-0 rounded-[var(--radius-control)] bg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-foreground/[0.06]"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
        />
      )}
      <motion.span
        whileHover={reduce ? undefined : { x: 2 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.3 }}
        className={cn(
          'relative z-10 flex items-center gap-2.5 transition-colors',
          active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        <Icon size={collapsed ? 20 : 17} weight={active ? 'fill' : 'regular'} />
        {!collapsed && item.label}
      </motion.span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className={cn('flex items-center px-2', collapsed ? 'justify-center' : 'justify-between')}>
        <Link href="/app" className="group flex items-center gap-2.5 text-foreground" onClick={onNavigate}>
          <span className="relative flex size-8 items-center justify-center rounded-full bg-foreground/[0.04] ring-1 ring-foreground/10">
            <span className="absolute inset-0 rounded-full bg-foreground/10 opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100" />
            <Image src="/brand/logo-white.png" alt="" width={20} height={19} className="relative h-5 w-auto [[data-theme=light]_&]:invert" />
          </span>
          {!collapsed && <span className="text-[0.9375rem] font-semibold tracking-tight">Convozy</span>}
        </Link>
        {onNavigate && (
          <button type="button" onClick={onNavigate} className="text-muted-foreground sm:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <AccountSwitcher collapsed={collapsed} onNavigate={onNavigate} />

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {collapsed ? (
            <span className="mx-3 h-px bg-border" aria-hidden />
          ) : (
            <span className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
              {group.label}
            </span>
          )}
          <nav className="group flex flex-col gap-1">
            {group.items.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
            ))}
          </nav>
        </div>
      ))}

      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'mt-auto flex items-center gap-2.5 rounded-[var(--radius-control)] py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <SidebarSimple size={collapsed ? 20 : 17} />
          {!collapsed && 'Collapse'}
        </button>
      )}
    </div>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Restored after mount so server and first client render agree; storage can
  // throw or be empty (private windows), in which case the sidebar stays open.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('convozy_sidebar_collapsed') === '1');
      if (localStorage.getItem('convozy_theme') === 'light') setTheme('light');
    } catch {
      // ignore
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Scoped to the dashboard: the attribute is removed on unmount so the
  // marketing site (dark-only) is never affected.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('convozy_theme', next);
    } catch {
      // ignore
    }
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem('convozy_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  function handleLogout() {
    clearTokens();
    router.replace('/app/login');
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      <DashboardBackdrop />
      <div className="relative z-10 flex min-h-[100dvh]">
      <aside
        className={cn(
          // Pinned to the viewport (not the page), so the sidebar is the same height on
          // every page and its items never move as the content grows or scrolls.
          'sticky top-0 hidden h-[100dvh] shrink-0 self-start border-r border-border transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:block',
          collapsed ? 'w-[76px]' : 'w-60',
        )}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-64 border-r border-border bg-background"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-[100dvh] flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="text-foreground sm:hidden"
            aria-label="Open menu"
          >
            <List size={22} />
          </button>

          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="group flex items-center gap-2.5 rounded-full border border-transparent py-1 pl-3 pr-1 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            Log out
            <span className="grid size-7 place-items-center rounded-full bg-muted transition-transform group-hover:-translate-y-px group-hover:translate-x-0.5">
              <SignOut size={14} weight="bold" />
            </span>
          </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <AccountGate pathname={pathname}>{children}</AccountGate>
        </main>
      </div>
      </div>
    </div>
  );
}

// Pages that work without a connected Instagram account: the account list
// itself, and workspace-level team management.
const ACCOUNT_OPTIONAL_PATHS = ['/app', '/app/settings/team'];

/**
 * Renders the page for the selected account. The page is keyed by the account
 * id, so switching accounts remounts it and every list reloads for the new one.
 */
function AccountGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { selected, loading, error, clearError, connect, connecting } = useAccounts();
  const optional = ACCOUNT_OPTIONAL_PATHS.includes(pathname);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selected && !optional) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <InstagramLogo size={26} weight="bold" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connect an Instagram account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Automations, contacts and tickets belong to an Instagram account. Connect one to get started.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {connecting && <CircleNotch size={16} className="animate-spin" />}
          Connect Instagram account
        </button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={clearError} className="text-xs underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}
      <div key={selected?.id ?? 'none'}>{children}</div>
    </>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <ShellInner>{children}</ShellInner>
    </AccountProvider>
  );
}
