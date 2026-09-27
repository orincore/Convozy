'use client';

import { useTicketStream } from '@/lib/ticket-stream';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaretLeft, CaretRight, MagnifyingGlass, SlidersHorizontal, TicketIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ApiError,
  ListTicketsParams,
  TeamMember,
  TicketCounts,
  TicketList,
  TicketPriority,
  TicketSource,
  TicketStatus,
  teamApi,
  ticketsApi,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/cn';
import {
  PRIORITY_ORDER,
  PriorityBadge,
  SOURCE_META,
  STATUS_META,
  STATUS_ORDER,
  StatusBadge,
  initials,
  participantLabel,
  timeAgo,
} from '@/components/tickets/ticket-meta';

type QuickView = 'mine' | 'unassigned' | 'active' | 'closed';

const QUICK_VIEWS: { key: QuickView; label: string }[] = [
  { key: 'mine', label: 'Assigned to me' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'active', label: 'All active' },
  { key: 'closed', label: 'Resolved and closed' },
];

function paramsFor(view: QuickView): ListTicketsParams {
  switch (view) {
    case 'mine':
      return { assignee: 'me', view: 'active' };
    case 'unassigned':
      return { assignee: 'unassigned', view: 'active' };
    case 'closed':
      return { view: 'closed' };
    default:
      return { view: 'active' };
  }
}

function Skeleton() {
  return (
    <div className="flex flex-col divide-y divide-border">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function TicketsPage() {
  const router = useRouter();
  const [view, setView] = useState<QuickView>('active');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [source, setSource] = useState<TicketSource | ''>('');
  const [assignee, setAssignee] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<TicketList | null>(null);
  const [counts, setCounts] = useState<TicketCounts | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const isAdmin = ['OWNER', 'ADMIN'].includes(getCurrentUser()?.role ?? '');

  const params = useMemo<ListTicketsParams>(() => {
    const base = paramsFor(view);
    return {
      ...base,
      status: status || undefined,
      priority: priority || undefined,
      source: source || undefined,
      assignee: assignee || base.assignee,
      search: search.trim() || undefined,
      page,
    };
  }, [view, status, priority, source, assignee, search, page]);

  const load = useCallback(() => {
    ticketsApi
      .list(params)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: ApiError) => setError(err.message));
    ticketsApi.counts().then(setCounts).catch(() => undefined);
  }, [params]);

  // Debounce typing in search; other filters apply immediately.
  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Live updates arrive over the stream; the slow poll only covers a dropped connection.
  useTicketStream(() => load());
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    teamApi.members().then(setMembers).catch(() => undefined);
  }, []);

  function switchView(next: QuickView) {
    setView(next);
    setPage(1);
    setAssignee('');
    setStatus('');
  }

  const countFor = (key: QuickView): number | null => {
    if (!counts) return null;
    if (key === 'mine') return counts.mine;
    if (key === 'unassigned') return counts.unassigned;
    if (key === 'active') return counts.active;
    return (counts.status.RESOLVED ?? 0) + (counts.status.CLOSED ?? 0);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complaints and support requests from comments, DMs, story mentions and tagged posts, one place for your team.
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/settings/tickets">
              <SlidersHorizontal size={14} />
              Ticket rules
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Ticket views">
        {QUICK_VIEWS.map((v) => {
          const n = countFor(v.key);
          const on = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => switchView(v.key)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                on ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {v.label}
              {n !== null && (
                <span className={cn('rounded-full px-1.5 text-xs', on ? 'bg-background/20' : 'bg-muted')}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by subject, @username or #number"
            aria-label="Search tickets"
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <SlidersHorizontal size={15} />
          Filters
        </Button>
      </div>

      {showFilters && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-border bg-card p-3 md:grid-cols-4">
          <Select aria-label="Status" value={status} className="h-10" onChange={(e) => { setStatus(e.target.value as TicketStatus | ''); setPage(1); }}>
            <option value="">Any status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </Select>
          <Select aria-label="Priority" value={priority} className="h-10" onChange={(e) => { setPriority(e.target.value as TicketPriority | ''); setPage(1); }}>
            <option value="">Any priority</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
            ))}
          </Select>
          <Select aria-label="Source" value={source} className="h-10" onChange={(e) => { setSource(e.target.value as TicketSource | ''); setPage(1); }}>
            <option value="">Any source</option>
            {Object.entries(SOURCE_META).map(([key, m]) => (
              <option key={key} value={key}>{m.label}</option>
            ))}
          </Select>
          <Select aria-label="Assignee" value={assignee} className="h-10" onChange={(e) => { setAssignee(e.target.value); setPage(1); }}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        {error && <p role="alert" className="px-5 py-10 text-center text-sm text-danger">{error}</p>}
        {!error && data === null && <Skeleton />}
        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <TicketIcon size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No tickets here</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                A ticket opens automatically when a comment @mentions your account or contains a complaint keyword,
                when someone DMs you about an open issue, mentions you in a story, or tags you in a post.
              </p>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/app/settings/tickets">Choose what opens a ticket</Link>
              </Button>
            )}
          </div>
        )}
        {data && data.items.length > 0 && (
          <ul className="divide-y divide-border">
            {data.items.map((t) => {
              const Source = SOURCE_META[t.source];
              const who = t.participants.map((p) => participantLabel(p)).join(', ');
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/tickets/${t.id}`)}
                    className="grid w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-muted md:grid-cols-[3rem_minmax(0,1fr)_auto_auto_2rem_5rem]"
                  >
                    <span className="text-xs font-medium text-muted-foreground">#{t.number}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{t.subject}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {who}
                        {t.participantCount > 3 ? ` +${t.participantCount - 3}` : ''}
                        {t.lastMessage ? `  |  ${t.lastMessage.kind === 'OUTBOUND' ? 'You: ' : t.lastMessage.kind === 'NOTE' ? 'Note: ' : ''}${t.lastMessage.text}` : ''}
                      </span>
                    </span>
                    <span className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Source.icon size={13} />
                        {Source.label}
                      </span>
                      <PriorityBadge priority={t.priority} />
                    </span>
                    <span className="col-start-2 md:col-start-auto">
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="hidden md:block" title={t.assignee ? t.assignee.name || t.assignee.email : 'Unassigned'}>
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[0.6875rem]">{t.assignee ? initials(t.assignee.name || t.assignee.email) : '-'}</AvatarFallback>
                      </Avatar>
                    </span>
                    <span className="hidden text-right text-xs text-muted-foreground md:block">{timeAgo(t.lastActivityAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.total > data.limit && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({data.total} tickets)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <CaretLeft size={14} />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
              <CaretRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
