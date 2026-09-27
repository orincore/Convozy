'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleNotch, EnvelopeSimple, GoogleLogo, Password, WarningCircle } from '@phosphor-icons/react';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { adminUsersApi, AdminUserDetail } from '@/lib/admin-api';
import { getCurrentAdmin } from '@/lib/admin-auth';

function initials(name: string | null | undefined, fallback = '?'): string {
  const source = (name ?? '').trim();
  if (!source) return fallback;
  const parts = source.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? fallback).toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

function money(cents: number | null, currency: string): string | null {
  if (cents === null) return null;
  return `${currency}${(cents / 100).toFixed(2)}`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

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
    <AdminChrome wide>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <Link href="/admin/users" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} />
          Back to users
        </Link>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-danger">
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
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-12">
                  <AvatarFallback className="text-sm">{initials(user.name || user.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">{user.name || user.email}</h1>
                    {user.isSuspended ? <Badge className="text-danger">Suspended</Badge> : <Badge variant="outline">Active</Badge>}
                    <Badge variant="outline">{user.role}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {user.hasPassword ? <Password size={12} /> : <EnvelopeSimple size={12} />}
                      {user.hasPassword ? 'Password set' : 'No password'}
                    </span>
                    {user.googleLinked && (
                      <span className="flex items-center gap-1">
                        <GoogleLogo size={12} />
                        Google linked
                      </span>
                    )}
                    <span>Joined {new Date(user.createdAt).toLocaleString()}</span>
                    {user.isSuspended && user.suspendedAt && <span>Suspended {new Date(user.suspendedAt).toLocaleString()}</span>}
                  </div>
                </div>
              </div>
              {canSuspend ? (
                <Button variant={user.isSuspended ? 'outline' : 'primary'} disabled={working} onClick={() => void toggleSuspended()}>
                  {working ? 'Working…' : user.isSuspended ? 'Unsuspend' : 'Suspend user'}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Only a superadmin can suspend or unsuspend a user.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Team members" value={String(user.workspace.users.length)} />
              <StatCard label="Instagram accounts" value={String(user.workspace.instagramAccounts.length)} />
              <StatCard label="Automations" value={String(user.workspace.automations.length)} />
              <StatCard label="Contacts" value={user.workspace.contactsCount.toLocaleString()} />
              <StatCard label="Open tickets" value={String(user.workspace.openTicketsCount)} hint={`${user.workspace.ticketsCount} total`} />
              <StatCard
                label="Sends this period"
                value={user.workspace.usage ? user.workspace.usage.sendsUsed.toLocaleString() : '—'}
                hint={
                  user.workspace.subscription
                    ? user.workspace.subscription.plan.monthlySendLimit === -1
                      ? 'Unlimited'
                      : `of ${user.workspace.subscription.plan.monthlySendLimit.toLocaleString()}`
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <SectionCard title="Workspace">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Name</dt>
                    <dd className="mt-0.5 font-medium">{user.workspace.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Created</dt>
                    <dd className="mt-0.5 font-medium">{new Date(user.workspace.createdAt).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Workspace ID</dt>
                    <dd className="mt-0.5 font-mono text-xs">{user.workspace.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">User ID</dt>
                    <dd className="mt-0.5 font-mono text-xs">{user.id}</dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="Billing">
                {user.workspace.subscription ? (
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Plan</dt>
                      <dd className="mt-0.5 font-medium">{user.workspace.subscription.plan.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Status</dt>
                      <dd className="mt-0.5">
                        <Badge variant="outline">{user.workspace.subscription.status}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Provider</dt>
                      <dd className="mt-0.5 font-medium">{user.workspace.subscription.provider}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Price</dt>
                      <dd className="mt-0.5 font-medium">
                        {money(user.workspace.subscription.plan.priceUsdCents, '$') ?? money(user.workspace.subscription.plan.priceInrPaise, '₹') ?? 'Free'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Renews / ends</dt>
                      <dd className="mt-0.5 font-medium">
                        {user.workspace.subscription.currentPeriodEnd ? new Date(user.workspace.subscription.currentPeriodEnd).toLocaleDateString() : '—'}
                        {user.workspace.subscription.cancelAtPeriodEnd && ' (cancels)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Max Instagram accounts</dt>
                      <dd className="mt-0.5 font-medium">{user.workspace.subscription.plan.maxInstagramAccounts}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">AI features</dt>
                      <dd className="mt-0.5 font-medium">{user.workspace.subscription.plan.aiFeaturesEnabled ? 'Enabled' : 'Off'}</dd>
                    </div>
                    {user.workspace.usage && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Usage period</dt>
                        <dd className="mt-0.5 font-medium">
                          {new Date(user.workspace.usage.periodStart).toLocaleDateString()} – {new Date(user.workspace.usage.periodEnd).toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No subscription — on the default free tier.</p>
                )}
              </SectionCard>
            </div>

            <SectionCard title={`Team (${user.workspace.users.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">Role</th>
                      <th className="pb-2 pr-4 font-medium">Joined</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.workspace.users.map((member) => (
                      <tr key={member.id} className="border-t border-border">
                        <td className="py-2.5 pr-4">
                          <Link href={`/admin/users/${member.id}`} className={member.id === user.id ? 'font-medium' : 'font-medium hover:underline'}>
                            {member.name || member.email}
                          </Link>
                          {member.id === user.id && <span className="ml-1.5 text-xs text-muted-foreground">(this account)</span>}
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{member.role}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{new Date(member.createdAt).toLocaleDateString()}</td>
                        <td className="py-2.5">
                          {member.isSuspended ? <Badge className="text-danger">Suspended</Badge> : <Badge variant="outline">Active</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title={`Connected Instagram accounts (${user.workspace.instagramAccounts.length})`}>
              {user.workspace.instagramAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">None connected.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Account</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Followers</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Token expires</th>
                        <th className="pb-2 font-medium">Connected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.workspace.instagramAccounts.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-7">
                                {a.profilePictureUrl && <AvatarImage src={a.profilePictureUrl} alt="" />}
                                <AvatarFallback className="text-[0.625rem]">{initials(a.displayName || a.igUsername)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">@{a.igUsername}</p>
                                {a.displayName && <p className="text-xs text-muted-foreground">{a.displayName}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{a.accountType ?? '—'}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{a.followersCount?.toLocaleString() ?? '—'}</td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="outline" className={a.status === 'ACTIVE' ? '' : 'text-danger'}>
                              {a.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{a.tokenExpiresAt ? new Date(a.tokenExpiresAt).toLocaleDateString() : '—'}</td>
                          <td className="py-2.5 text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={`Automations (${user.workspace.automations.length})`}>
              {user.workspace.automations.length === 0 ? (
                <p className="text-sm text-muted-foreground">None created.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Name</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.workspace.automations.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="py-2.5 pr-4 font-medium">{a.name}</td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="outline">{a.status}</Badge>
                          </td>
                          <td className="py-2.5 text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <SectionCard title="Workspace activity">
                {user.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3 text-sm">
                    {user.recentActivity.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{a.action}</p>
                          <p className="text-xs text-muted-foreground">{a.actor ? a.actor.name || a.actor.email : 'System'}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Admin actions on this account">
                {user.adminActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admin actions taken on this account.</p>
                ) : (
                  <ul className="flex flex-col gap-3 text-sm">
                    {user.adminActions.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{a.action}</p>
                          <p className="text-xs text-muted-foreground">{a.admin.email}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </AdminChrome>
  );
}
