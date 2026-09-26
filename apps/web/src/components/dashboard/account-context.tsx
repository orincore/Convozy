'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, ConnectedAccount, instagramApi } from '@/lib/api';
import { getSelectedAccountId, setSelectedAccountId } from '@/lib/account';
import { connectInstagramAccount } from '@/lib/connect-instagram';

interface AccountContextValue {
  accounts: ConnectedAccount[];
  /** The account every page is currently working on; null when none is connected. */
  selected: ConnectedAccount | null;
  loading: boolean;
  connecting: boolean;
  error: string | null;
  clearError: () => void;
  select: (id: string) => void;
  reload: () => Promise<ConnectedAccount[]>;
  replaceAccount: (account: ConnectedAccount) => void;
  /** Opens Instagram login in a popup, then selects the newly connected account. */
  connect: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccounts(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccounts must be used inside <AccountProvider>');
  return ctx;
}

function pickSelected(list: ConnectedAccount[], preferredId: string | null): ConnectedAccount | null {
  return list.find((a) => a.id === preferredId) ?? list[0] ?? null;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((list: ConnectedAccount[], preferredId: string | null) => {
    const next = pickSelected(list, preferredId);
    // Written before state so pages mounted by the change already send it.
    setSelectedAccountId(next?.id ?? null);
    setAccounts(list);
    setSelectedIdState(next?.id ?? null);
    return next;
  }, []);

  const reload = useCallback(async () => {
    const list = await instagramApi.listAccounts();
    apply(list, getSelectedAccountId());
    return list;
  }, [apply]);

  useEffect(() => {
    instagramApi
      .listAccounts()
      .then((list) => apply(list, getSelectedAccountId()))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apply]);

  const select = useCallback(
    (id: string) => {
      if (!accounts.some((a) => a.id === id)) return;
      setSelectedAccountId(id);
      setSelectedIdState(id);
    },
    [accounts],
  );

  const replaceAccount = useCallback((account: ConnectedAccount) => {
    setAccounts((current) => current.map((a) => (a.id === account.id ? account : a)));
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    const before = new Set(accounts.map((a) => a.id));
    try {
      const result = await connectInstagramAccount();
      if (result.status === 'error') {
        setError(result.message ?? 'Could not connect the account.');
        return;
      }
      if (result.status === 'closed') return;
      const list = await instagramApi.listAccounts();
      const added = list.find((a) => !before.has(a.id));
      apply(list, added?.id ?? getSelectedAccountId());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect the account.');
    } finally {
      setConnecting(false);
    }
  }, [accounts, apply]);

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      selected: accounts.find((a) => a.id === selectedId) ?? null,
      loading,
      connecting,
      error,
      clearError: () => setError(null),
      select,
      reload,
      replaceAccount,
      connect,
    }),
    [accounts, selectedId, loading, connecting, error, select, reload, replaceAccount, connect],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
