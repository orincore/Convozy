'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowsClockwise, CheckCircle, CircleNotch, InstagramLogo, LinkBreak, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ApiError, ConnectedAccount, instagramApi } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  RATE_LIMITED: 'Rate limited',
  TOKEN_EXPIRED: 'Reconnect needed',
  DISCONNECTED: 'Disconnected',
  ERROR: 'Error',
};

function followerLabel(count: number | null): string | null {
  if (count === null) return null;
  return `${new Intl.NumberFormat('en', { notation: 'compact' }).format(count)} followers`;
}

function ConnectPrompt({ onConnect, connecting }: { onConnect: () => void; connecting: boolean }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
        <InstagramLogo size={26} weight="bold" className="text-foreground" />
      </div>

      <div>
        <h1 className="text-xl font-semibold">Connect an Instagram account</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Link your Instagram Business account to start automating comment replies and DMs.
        </p>
      </div>

      <Button onClick={onConnect} disabled={connecting}>
        {connecting && <CircleNotch size={16} className="animate-spin" />}
        Connect Instagram account
      </Button>
    </div>
  );
}

function AccountAvatar({ account }: { account: ConnectedAccount }) {
  if (account.profilePictureUrl) {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
        <Image
          src={account.profilePictureUrl}
          alt={`@${account.igUsername}`}
          fill
          sizes="36px"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
      <InstagramLogo size={18} weight="bold" />
    </div>
  );
}

function AccountRow({
  account,
  onSync,
  syncing,
  onDisconnect,
  disconnecting,
}: {
  account: ConnectedAccount;
  onSync: () => void;
  syncing: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const followers = followerLabel(account.followersCount);
  const busy = syncing || disconnecting;
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
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
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`text-xs font-medium ${account.status === 'ACTIVE' ? 'text-success' : 'text-danger'}`}
        >
          {STATUS_LABEL[account.status] ?? account.status}
        </span>
        <button
          type="button"
          onClick={onSync}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label={`Refresh profile for @${account.igUsername}`}
          title="Refresh profile"
        >
          <ArrowsClockwise size={15} className={syncing ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50"
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
  onConnectAnother,
  connecting,
  onSync,
  syncingId,
  onDisconnect,
  disconnectingId,
}: {
  accounts: ConnectedAccount[];
  onConnectAnother: () => void;
  connecting: boolean;
  onSync: (accountId: string) => void;
  syncingId: string | null;
  onDisconnect: (accountId: string) => void;
  disconnectingId: string | null;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Connected accounts</h1>
        <Button onClick={onConnectAnother} disabled={connecting} variant="outline" size="sm">
          {connecting && <CircleNotch size={14} className="animate-spin" />}
          Connect another
        </Button>
      </div>

      <div className="mt-6 flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onSync={() => onSync(account.id)}
            syncing={syncingId === account.id}
            onDisconnect={() => onDisconnect(account.id)}
            disconnecting={disconnectingId === account.id}
          />
        ))}
      </div>
    </div>
  );
}

function DashboardHome() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get('instagram_error'));
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  useEffect(() => {
    instagramApi
      .listAccounts()
      .then((data) => setAccounts(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const data = await instagramApi.startOAuth();
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setConnecting(false);
    }
  }

  async function handleSync(accountId: string) {
    setSyncingId(accountId);
    setError(null);
    try {
      const updated = await instagramApi.syncProfile(accountId);
      setAccounts((current) => current?.map((a) => (a.id === accountId ? updated : a)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not refresh this account's profile.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    const account = accounts?.find((a) => a.id === accountId);
    const label = account ? `@${account.igUsername}` : 'this account';
    const confirmed = window.confirm(
      `Disconnect ${label}? Automations tied to it will stop sending until you reconnect.`,
    );
    if (!confirmed) return;

    setDisconnectingId(accountId);
    setError(null);
    try {
      await instagramApi.disconnect(accountId);
      setAccounts((current) => current?.filter((a) => a.id !== accountId) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not disconnect this account.');
    } finally {
      setDisconnectingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {searchParams.get('instagram') === 'connected' && (
        <div className="mb-6 flex items-center gap-2 rounded-[var(--radius-control)] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle size={16} weight="bold" />
          Instagram account connected.
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      {accounts && accounts.length > 0 ? (
        <AccountsList
          accounts={accounts}
          onConnectAnother={handleConnect}
          connecting={connecting}
          onSync={handleSync}
          syncingId={syncingId}
          onDisconnect={handleDisconnect}
          disconnectingId={disconnectingId}
        />
      ) : (
        <ConnectPrompt onConnect={handleConnect} connecting={connecting} />
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
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <CircleNotch size={24} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardHome />
    </Suspense>
  );
}
