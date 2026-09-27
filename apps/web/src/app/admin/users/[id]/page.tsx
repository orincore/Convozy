'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { adminUsersApi, AdminUserDetail } from '@/lib/admin-api';
import { getCurrentAdmin } from '@/lib/admin-auth';

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const admin = getCurrentAdmin();
  const canSuspend = admin?.role === 'SUPERADMIN';

  function load() {
    setError(null);
    adminUsersApi
      .get(id)
      .then(setUser)
      .catch((err: ApiError) => setError(err.message));
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function toggleSuspended() {
    if (!user) return;
    setWorking(true);
    try {
      await adminUsersApi.setSuspended(user.id, !user.isSuspended);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this user');
    } finally {
      setWorking(false);
    }
  }

  return (
    <AdminChrome>
      <Link href="/admin/users" className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Back to users
      </Link>

      {error && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-danger">
          <WarningCircle size={14} />
          {error}
        </p>
      )}

      {!user && !error && (
        <div className="flex items-center justify-center py-16">
          <CircleNotch size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {user && (
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{user.name || user.email}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>
            {user.isSuspended ? <Badge className="text-danger">Suspended</Badge> : <Badge variant="outline">Active</Badge>}
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Workspace role</dt>
              <dd className="mt-0.5 font-medium">{user.role}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Workspace</dt>
              <dd className="mt-0.5 font-medium">{user.workspace.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Joined</dt>
              <dd className="mt-0.5 font-medium">{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Instagram accounts</dt>
              <dd className="mt-0.5 font-medium">{user.workspace.instagramAccounts.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Automations</dt>
              <dd className="mt-0.5 font-medium">{user.workspace.automations.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Plan</dt>
              <dd className="mt-0.5 font-medium">
                {user.workspace.subscription ? `${user.workspace.subscription.planId} · ${user.workspace.subscription.status}` : 'None'}
              </dd>
            </div>
          </dl>

          {user.workspace.instagramAccounts.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Connected Instagram accounts</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {user.workspace.instagramAccounts.map((a) => (
                  <li key={a.id}>@{a.igUsername}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-[var(--radius-card)] border border-border p-5">
            <h2 className="text-sm font-semibold">
              {user.isSuspended ? 'Suspended' : 'Suspend this account'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.isSuspended
                ? `Blocked from signing in since ${user.suspendedAt ? new Date(user.suspendedAt).toLocaleString() : 'unknown'}.`
                : 'Immediately blocks this person from signing in. Their workspace and data are untouched.'}
            </p>
            {canSuspend ? (
              <Button
                variant={user.isSuspended ? 'outline' : 'primary'}
                className="mt-4"
                disabled={working}
                onClick={toggleSuspended}
              >
                {working ? 'Working…' : user.isSuspended ? 'Unsuspend' : 'Suspend user'}
              </Button>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Only a superadmin can suspend or unsuspend a user.</p>
            )}
          </div>
        </div>
      )}
    </AdminChrome>
  );
}
