'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InstagramLogo, CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ApiError, ConnectedAccount, instagramApi } from '@/lib/api';

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

function AccountsList({ accounts, onConnectAnother, connecting }: {
  accounts: ConnectedAccount[];
  onConnectAnother: () => void;
  connecting: boolean;
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
          <div key={account.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <InstagramLogo size={18} weight="bold" />
              </div>
              <div>
                <p className="text-sm font-medium">@{account.igUsername}</p>
                <p className="text-xs text-muted-foreground">
                  {account.accountType ?? 'Instagram account'}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-medium ${
                account.status === 'ACTIVE' ? 'text-success' : 'text-danger'
              }`}
            >
              {account.status === 'ACTIVE' ? 'Active' : account.status}
            </span>
          </div>
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
        <AccountsList accounts={accounts} onConnectAnother={handleConnect} connecting={connecting} />
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
