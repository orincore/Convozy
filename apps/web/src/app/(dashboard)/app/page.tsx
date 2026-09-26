'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowsClockwise, CheckCircle, CircleNotch, InstagramLogo, LinkBreak, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { StatusPill, STATUS_PILL } from '@/components/dashboard/status-pill';
import { AccountRowSkeleton } from '@/components/dashboard/skeleton';
import { Bezel } from '@/components/marketing/bezel';
import { SpotlightCard } from '@/components/marketing/spotlight-card';
import { CtaButton } from '@/components/marketing/cta-button';
import { ApiError, ConnectedAccount, instagramApi } from '@/lib/api';
import { useAccounts } from '@/components/dashboard/account-context';

function followerLabel(count: number | null): string | null {
  if (count === null) return null;
  return `${new Intl.NumberFormat('en', { notation: 'compact' }).format(count)} followers`;
}

function ConnectPrompt({ onConnect, connecting }: { onConnect: () => void; connecting: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center"
      initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-[-1.5rem] rounded-full bg-foreground/[0.06] blur-2xl" aria-hidden />
        <span className="cta-glow absolute inset-0 rounded-full border border-foreground/10 bg-card" aria-hidden />
        <InstagramLogo size={30} weight="bold" className="relative text-foreground" />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          Connect an <span className="text-gradient">Instagram account</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">
          Link your Instagram Business account to start automating comment replies and DMs.
        </p>
      </div>

      <CtaButton onClick={onConnect} disabled={connecting}>
        {connecting ? <CircleNotch size={16} className="animate-spin" /> : null}
        Connect Instagram account
      </CtaButton>
    </motion.div>
  );
}

function AccountAvatar({ account }: { account: ConnectedAccount }) {
  if (account.profilePictureUrl) {
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <Image
          src={account.profilePictureUrl}
          alt={`@${account.igUsername}`}
          fill
          sizes="40px"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border">
      <InstagramLogo size={18} weight="bold" />
    </div>
  );
}

function AccountRow({
  account,
  selected,
  onSelect,
  onSync,
  syncing,
  onDisconnect,
  disconnecting,
}: {
  account: ConnectedAccount;
  selected: boolean;
  onSelect: () => void;
  onSync: () => void;
  syncing: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const followers = followerLabel(account.followersCount);
  const busy = syncing || disconnecting;
  const status = syncing
    ? STATUS_PILL.SYNCING
    : STATUS_PILL[account.status as keyof typeof STATUS_PILL] ?? STATUS_PILL.ERROR;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <AccountAvatar account={account} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.displayName ?? `@${account.igUsername}`}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{account.igUsername}
            {account.accountType && ` · ${account.accountType}`}
            {followers && ` · ${followers}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <StatusPill label={status.label} tone={status.tone} icon={status.icon} spin={syncing} />
        {selected ? (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">Working on this</span>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onSelect}>
            Switch to this
          </Button>
        )}
        <button
          type="button"
          onClick={onSync}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
          aria-label={`Refresh profile for @${account.igUsername}`}
          title="Refresh profile"
        >
          <ArrowsClockwise size={15} className={syncing ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger active:scale-95 disabled:opacity-50"
          aria-label={`Disconnect @${account.igUsername}`}
          title="Disconnect"
        >
          {disconnecting ? <CircleNotch size={15} className="animate-spin" /> : <LinkBreak size={15} />}
        </button>
      </div>
    </div>
  );
}

function AccountsList({
  accounts,
  selectedId,
  onSelect,
  onConnectAnother,
  connecting,
  onSync,
  syncingId,
  onDisconnect,
  disconnectingId,
}: {
  accounts: ConnectedAccount[];
  selectedId: string | null;
  onSelect: (accountId: string) => void;
  onConnectAnother: () => void;
  connecting: boolean;
  onSync: (accountId: string) => void;
  syncingId: string | null;
  onDisconnect: (accountId: string) => void;
  disconnectingId: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            Connected <span className="text-gradient">accounts</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {accounts.length} account{accounts.length === 1 ? '' : 's'} linked. Each one keeps its own automations, contacts and tickets.
          </p>
        </div>
        <Button onClick={onConnectAnother} disabled={connecting} variant="outline" size="sm">
          {connecting && <CircleNotch size={14} className="animate-spin" />}
          Add account
        </Button>
      </div>

      {/* Each account is its own elevated card (Bezel nested shell +
          SpotlightCard's cursor-tracked border glow), not a flat table row -
          matches the marketing site's card language instead of reinventing
          a plainer one. */}
      <div className="mt-6 flex flex-col gap-3">
        {accounts.map((account, i) => (
          <motion.div
            key={account.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <SpotlightCard className="rounded-[1.5rem]">
              <Bezel className="rounded-[1.5rem]" coreClassName="rounded-[calc(1.5rem-0.375rem)]">
                <AccountRow
                  account={account}
                  selected={account.id === selectedId}
                  onSelect={() => onSelect(account.id)}
                  onSync={() => onSync(account.id)}
                  syncing={syncingId === account.id}
                  onDisconnect={() => onDisconnect(account.id)}
                  disconnecting={disconnectingId === account.id}
                />
              </Bezel>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <span className="block h-7 w-48 animate-pulse rounded-[var(--radius-control)] bg-muted motion-reduce:animate-none" />
          <span className="block h-3.5 w-56 animate-pulse rounded-[var(--radius-control)] bg-muted motion-reduce:animate-none" />
        </div>
        <span className="block h-9 w-36 animate-pulse rounded-[var(--radius-control)] bg-muted motion-reduce:animate-none" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Bezel key={i} className="rounded-[1.5rem]" coreClassName="rounded-[calc(1.5rem-0.375rem)]">
            <AccountRowSkeleton />
          </Bezel>
        ))}
      </div>
    </div>
  );
}

function DashboardHome() {
  const searchParams = useSearchParams();
  const { accounts, selected, select, loading, connecting, connect, reload, replaceAccount, error: contextError } = useAccounts();
  const [error, setError] = useState<string | null>(searchParams.get('instagram_error'));
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  async function handleSync(accountId: string) {
    setSyncingId(accountId);
    setError(null);
    try {
      replaceAccount(await instagramApi.syncProfile(accountId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not refresh this account's profile.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    const label = account ? `@${account.igUsername}` : 'this account';
    const confirmed = window.confirm(
      `Disconnect ${label}? Automations tied to it will stop sending until you reconnect.`,
    );
    if (!confirmed) return;

    setDisconnectingId(accountId);
    setError(null);
    try {
      await instagramApi.disconnect(accountId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not disconnect this account.');
    } finally {
      setDisconnectingId(null);
    }
  }

  if (loading) {
    return <AccountsSkeleton />;
  }

  const shownError = error ?? contextError;

  return (
    <div>
      {searchParams.get('instagram') === 'connected' && (
        <div className="mb-6 flex items-center gap-2 rounded-[var(--radius-control)] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle size={16} weight="bold" />
          Instagram account connected.
        </div>
      )}
      {shownError && (
        <div className="mb-6 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {shownError}
        </div>
      )}

      {accounts.length > 0 ? (
        <AccountsList
          accounts={accounts}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onConnectAnother={() => void connect()}
          connecting={connecting}
          onSync={handleSync}
          syncingId={syncingId}
          onDisconnect={handleDisconnect}
          disconnectingId={disconnectingId}
        />
      ) : (
        <ConnectPrompt onConnect={() => void connect()} connecting={connecting} />
      )}
    </div>
  );
}

/**
 * Dashboard home. Shows connected Instagram accounts, or a connect prompt
 * if none yet (Phase 1). Automation overview (Phase 2) lands once
 * automations exist.
 */
export default function DashboardHomePage() {
  return (
    <Suspense fallback={<AccountsSkeleton />}>
      <DashboardHome />
    </Suspense>
  );
}
