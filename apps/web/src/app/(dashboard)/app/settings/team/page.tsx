'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, CircleNotch, DotsThree, EnvelopeSimple, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ApiError, TeamInvite, TeamMember, TeamRole, teamApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { initials } from '@/components/tickets/ticket-meta';

const ROLE_LABEL: Record<TeamRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Agent' };
const ROLE_HINT: Record<TeamRole, string> = {
  OWNER: 'Full access, billing and team',
  ADMIN: 'Manages team and ticket rules, works tickets',
  MEMBER: 'Works tickets: reply, assign, change status',
};

export default function TeamPage() {
  const me = getCurrentUser();
  const isOwner = me?.role === 'OWNER';
  const canManage = me?.role === 'OWNER' || me?.role === 'ADMIN';

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    teamApi.members().then(setMembers).catch((err: ApiError) => setError(err.message));
    if (canManage) teamApi.invites().then(setInvites).catch(() => undefined);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setLink(null);
    try {
      const { invite: created, token } = await teamApi.invite({ email: email.trim(), role });
      setLink({ email: created.email, url: `${window.location.origin}/app/invite/${token}` });
      setEmail('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the invite');
    } finally {
      setInviting(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is selectable in the field.
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everyone here can work tickets. Assign complaints to teammates and keep track together.</p>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      {canManage && (
        <form onSubmit={invite} className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-6">
          <div>
            <h2 className="text-sm font-semibold">Invite a teammate</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              They sign in with Google using this email and join your workspace. We&apos;ll email them the link — you can also copy and share it yourself below.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Google email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select id="invite-role" className="h-10 w-full" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}>
                <option value="MEMBER">Agent</option>
                {isOwner && <option value="ADMIN">Admin</option>}
              </Select>
            </div>
            <Button type="submit" disabled={inviting || !email.trim()}>
              {inviting ? <CircleNotch size={16} className="animate-spin" /> : <EnvelopeSimple size={16} />}
              Create invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{ROLE_HINT[role === 'ADMIN' ? 'ADMIN' : 'MEMBER']}</p>

          {link && (
            <div className="rounded-[var(--radius-control)] border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Invite link for {link.email}. It is shown once and expires in 7 days.</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={link.url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" onClick={() => void copy()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}

      <section aria-label="Members" className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Members {members ? `(${members.length})` : ''}</h2>
        {!members && !error && <div className="flex justify-center py-8"><CircleNotch size={20} className="animate-spin text-muted-foreground" /></div>}
        <ul className="divide-y divide-border">
          {members?.map((m) => {
            const self = m.id === me?.userId;
            const canRemove = canManage && !self && m.role !== 'OWNER' && (m.role !== 'ADMIN' || isOwner);
            const canChangeRole = isOwner && !self && m.role !== 'OWNER';
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="size-9">
                  <AvatarFallback>{initials(m.name || m.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name || m.email}{self ? ' (you)' : ''}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                {(canRemove || canChangeRole) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label={`Actions for ${m.name || m.email}`}>
                        <DotsThree size={18} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canChangeRole && (
                        <DropdownMenuItem onSelect={() => void run(() => teamApi.updateRole(m.id, m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'))}>
                          Make {m.role === 'ADMIN' ? 'agent' : 'admin'}
                        </DropdownMenuItem>
                      )}
                      {canChangeRole && canRemove && <DropdownMenuSeparator />}
                      {canRemove && (
                        <DropdownMenuItem variant="danger" onSelect={() => { if (window.confirm(`Remove ${m.name || m.email} from the workspace? Their tickets become unassigned.`)) void run(() => teamApi.remove(m.id)); }}>
                          Remove from workspace
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && invites.length > 0 && (
        <section aria-label="Pending invites" className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Pending invites ({invites.length})</h2>
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.email}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[i.role]}, expires {new Date(i.expiresAt).toLocaleDateString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Revoke the invite for ${i.email}? The link they have will stop working.`)) {
                      void run(() => teamApi.revokeInvite(i.id));
                    }
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
