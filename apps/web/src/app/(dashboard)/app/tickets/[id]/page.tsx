'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowSquareOut,
  ChatCircleDots,
  CheckCircle,
  CircleNotch,
  LockSimple,
  NotePencil,
  PaperPlaneRight,
  UserCirclePlus,
  WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ApiError,
  TeamMember,
  TicketDetail,
  TicketEvent,
  TicketMessage,
  TicketParticipant,
  TicketPriority,
  TicketStatus,
  teamApi,
  ticketsApi,
} from '@/lib/api';
import { TicketComposer } from '@/components/tickets/composer';
import { ThreadView, buildThread } from '@/components/tickets/thread';
import { useTicketStream } from '@/lib/ticket-stream';
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

function fullDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function describeEvent(e: TicketEvent, people: Map<string, string>): string {
  const who = e.actor?.name || 'Someone';
  const d = (e.data ?? {}) as Record<string, string | null>;
  const status = (s?: string | null) => (s && s in STATUS_META ? STATUS_META[s as TicketStatus].label : s ?? '');
  switch (e.type) {
    case 'CREATED':
      return `Ticket opened from ${SOURCE_META[(d.source as keyof typeof SOURCE_META) ?? 'COMMENT']?.label.toLowerCase() ?? 'Instagram'}`;
    case 'STATUS_CHANGED':
      return `${who} changed status from ${status(d.from)} to ${status(d.to)}`;
    case 'PRIORITY_CHANGED':
      return `${who} changed priority from ${d.from} to ${d.to}`;
    case 'ASSIGNED':
      return d.to ? `${who} assigned this to ${people.get(d.to) ?? 'a teammate'}` : `${who} unassigned this ticket`;
    case 'REOPENED':
      return 'Reopened after a new message';
    case 'PARTICIPANT_JOINED':
      return `${d.username ? `@${d.username}` : 'Someone else'} joined this ticket`;
    default:
      return e.type;
  }
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = getCurrentUser();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState('');
  const threadEnd = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(() => {
    ticketsApi
      .get(id)
      .then((t) => {
        setTicket(t);
        setError(null);
      })
      .catch((err: ApiError) => setError(err.message));
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    teamApi.members().then(setMembers).catch(() => undefined);
  }, []);
  const live = useTicketStream((e) => {
    if (e.ticketId === id) load();
  });
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Follow the conversation only when something new arrived, not on every poll.
  useEffect(() => {
    const count = ticket?.messages.length ?? 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      threadEnd.current?.scrollIntoView({ block: 'end' });
    }
  }, [ticket?.messages.length]);

  const people = useMemo(() => new Map(members.map((m) => [m.id, m.name || m.email])), [members]);
  const thread = useMemo(() => buildThread(ticket?.messages ?? [], [], null), [ticket?.messages]);

  async function patch(input: Parameters<typeof ticketsApi.update>[1]) {
    setActionError(null);
    try {
      setTicket(await ticketsApi.update(id, input));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the ticket');
    }
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/tickets">Back to tickets</Link>
        </Button>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Source = SOURCE_META[ticket.source];
  const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Tickets
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>#{ticket.number}</span>
            <span className="inline-flex items-center gap-1">
              <Source.icon size={14} />
              {Source.label}
            </span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{ticket.subject}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            <span className={cn('size-1.5 rounded-full', live === 'live' ? 'bg-success' : 'bg-muted-foreground')} />
            {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Reconnecting'}
          </span>
          <Button variant="outline" asChild>
            <Link href={`/app/tickets/${ticket.id}/chat`}>
              <ChatCircleDots size={16} />
              Open full chat
            </Link>
          </Button>
          {isClosed ? (
            <Button variant="outline" onClick={() => patch({ status: 'OPEN' })}>
              Reopen
            </Button>
          ) : (
            <Button onClick={() => patch({ status: 'RESOLVED' })}>
              <CheckCircle size={16} />
              Mark resolved
            </Button>
          )}
        </div>
      </header>

      {actionError && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {actionError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section aria-label="Conversation" className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <div className="flex max-h-[62dvh] min-h-64 flex-col gap-4 overflow-y-auto p-5">
            <ThreadView items={thread} participants={ticket.participants} />
            <div ref={threadEnd} />
          </div>

          <Separator />

          <TicketComposer
            ticket={ticket}
            participantId={participantId}
            onParticipantChange={setParticipantId}
            onSent={load}
            onError={setActionError}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Details</h2>
            <Field label="Status">
              <Select aria-label="Status" value={ticket.status} className="h-10 w-full" onChange={(e) => void patch({ status: e.target.value as TicketStatus })}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select aria-label="Priority" value={ticket.priority} className="h-10 w-full" onChange={(e) => void patch({ priority: e.target.value as TicketPriority })}>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee">
              <Select aria-label="Assignee" value={ticket.assignee?.id ?? ''} className="h-10 w-full" onChange={(e) => void patch({ assigneeId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </Select>
              {me && ticket.assignee?.id !== me.userId && (
                <button
                  type="button"
                  onClick={() => void patch({ assigneeId: me.userId })}
                  className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <UserCirclePlus size={14} />
                  Assign to me
                </button>
              )}
            </Field>
            <Separator />
            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Account</dt><dd>@{ticket.instagramAccount.igUsername}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Opened</dt><dd>{fullDate(ticket.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">First reply</dt><dd>{fullDate(ticket.firstResponseAt)}</dd></div>
              {ticket.resolvedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Resolved</dt><dd>{fullDate(ticket.resolvedAt)}</dd></div>}
            </dl>
            {ticket.mediaPermalink && (
              <a
                href={ticket.mediaPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <ArrowSquareOut size={13} />
                View the post on Instagram
              </a>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">People ({ticket.participants.length})</h2>
            <ul className="flex flex-col gap-3">
              {ticket.participants.map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-[0.6875rem]">{initials(p.name || p.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{participantLabel(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.replyOptions.dmMode === 'DM'
                        ? 'Can message now'
                        : p.replyOptions.dmMode === 'HUMAN_AGENT'
                          ? 'Can message (human agent, 7 days)'
                        : p.replyOptions.dmMode === 'PRIVATE_REPLY'
                          ? 'One private reply available'
                          : 'Cannot message'}
                      {p.replyOptions.canPublicReply ? ', can reply publicly' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ChatCircleDots size={15} />
              Activity
            </h2>
            <ol className="flex flex-col gap-3 border-l border-border pl-4">
              {[...ticket.events].reverse().map((e) => (
                <li key={e.id} className="text-xs">
                  <p className="text-foreground">{describeEvent(e, people)}</p>
                  <p className="text-muted-foreground">{timeAgo(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
