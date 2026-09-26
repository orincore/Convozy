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
  timeAgo,
} from '@/components/tickets/ticket-meta';

type Mode = 'DM' | 'PUBLIC_REPLY' | 'NOTE';

const CHANNEL_LABEL: Record<TicketMessage['channel'], string> = {
  COMMENT: 'Comment',
  DM: 'Direct message',
  PUBLIC_REPLY: 'Public reply',
  NOTE: 'Internal note',
  TAGGED_POST: 'Tagged post',
};

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
  const [chosenMode, setMode] = useState<Mode>('DM');
  const [participantId, setParticipantId] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !sending) load();
    }, 10_000);
    return () => clearInterval(t);
  }, [load, sending]);

  // Follow the conversation only when something new arrived, not on every poll.
  useEffect(() => {
    const count = ticket?.messages.length ?? 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      threadEnd.current?.scrollIntoView({ block: 'end' });
    }
  }, [ticket?.messages.length]);

  const people = useMemo(() => new Map(members.map((m) => [m.id, m.name || m.email])), [members]);
  const participantById = useMemo(() => new Map((ticket?.participants ?? []).map((p) => [p.id, p])), [ticket]);

  // Default to the most recently active person.
  const activeParticipant: TicketParticipant | undefined =
    participantById.get(participantId) ?? ticket?.participants[ticket.participants.length - 1];
  const options = activeParticipant?.replyOptions;

  const modeAvailable = (m: Mode): boolean => {
    if (m === 'NOTE') return true;
    if (!options) return false;
    return m === 'DM' ? options.dmMode !== null : options.canPublicReply;
  };

  // If the chosen mode isn't possible for this person, fall back to one that is.
  const mode: Mode = modeAvailable(chosenMode)
    ? chosenMode
    : (['DM', 'PUBLIC_REPLY', 'NOTE'] as Mode[]).find(modeAvailable) ?? 'NOTE';

  async function patch(input: Parameters<typeof ticketsApi.update>[1]) {
    setActionError(null);
    try {
      setTicket(await ticketsApi.update(id, input));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the ticket');
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !ticket) return;
    setSending(true);
    setActionError(null);
    try {
      if (mode === 'NOTE') {
        await ticketsApi.addNote(id, body);
      } else if (activeParticipant) {
        await ticketsApi.reply(id, { participantId: activeParticipant.id, channel: mode, text: body });
      }
      setText('');
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not send');
    } finally {
      setSending(false);
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
  const modeLabel: Record<Mode, string> = {
    DM: options?.dmMode === 'PRIVATE_REPLY' ? 'Private reply' : 'Direct message',
    PUBLIC_REPLY: 'Public reply',
    NOTE: 'Internal note',
  };
  const disabledReason =
    mode === 'DM' && options?.dmMode === null
      ? options.dmUnavailableReason
      : mode === 'PUBLIC_REPLY' && options && !options.canPublicReply
        ? 'This person has no comment to reply to publicly.'
        : null;

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
        <div className="flex gap-2">
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
            {ticket.messages.map((m) => {
              const p = m.participantId ? participantById.get(m.participantId) : undefined;
              if (m.kind === 'NOTE') {
                return (
                  <div key={m.id} className="rounded-[var(--radius-control)] border border-dashed border-border bg-muted px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <NotePencil size={13} />
                      Internal note by {m.author?.name || 'a teammate'}, {timeAgo(m.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{m.text}</p>
                  </div>
                );
              }
              const outbound = m.kind === 'OUTBOUND';
              return (
                <div key={m.id} className={cn('flex gap-3', outbound && 'flex-row-reverse')}>
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[0.6875rem]">
                      {outbound ? initials(m.author?.name, 'Y') : initials(p?.username, '?')}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn('flex max-w-[80%] flex-col gap-1', outbound && 'items-end')}>
                    <p className="text-xs text-muted-foreground">
                      {outbound ? m.author?.name || 'Your team' : p?.username ? `@${p.username}` : 'Customer'}
                      {', '}
                      {CHANNEL_LABEL[m.channel]}
                      {outbound && p?.username ? ` to @${p.username}` : ''}, {timeAgo(m.createdAt)}
                    </p>
                    <p
                      className={cn(
                        'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm',
                        outbound ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground',
                        m.status === 'FAILED' && 'opacity-60',
                      )}
                    >
                      {m.text}
                    </p>
                    {m.status === 'FAILED' && (
                      <p className="flex items-center gap-1 text-xs text-danger">
                        <WarningCircle size={12} />
                        Not delivered: {m.error ?? 'Instagram rejected the message'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={threadEnd} />
          </div>

          <Separator />

          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(['DM', 'PUBLIC_REPLY', 'NOTE'] as Mode[]).map((m) => {
                const on = mode === m;
                const ok = modeAvailable(m);
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!ok}
                    onClick={() => setMode(m)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      on ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {modeLabel[m]}
                  </button>
                );
              })}
              {ticket.participants.length > 1 && mode !== 'NOTE' && (
                <Select
                  aria-label="Reply to"
                  value={activeParticipant?.id ?? ''}
                  className="ml-auto h-8 max-w-48 text-xs"
                  onChange={(e) => setParticipantId(e.target.value)}
                >
                  {ticket.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      Reply to @{p.username ?? 'unknown'}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {mode === 'DM' && options?.dmMode === 'PRIVATE_REPLY' && (
              <p className="text-xs text-muted-foreground">
                Instagram allows only one private reply to a comment. After it, they can reply and you can chat normally.
              </p>
            )}
            {disabledReason && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <LockSimple size={13} className="mt-px shrink-0" />
                {disabledReason}
              </p>
            )}

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
              }}
              rows={3}
              maxLength={mode === 'NOTE' ? 4000 : 1000}
              disabled={Boolean(disabledReason) && mode !== 'NOTE'}
              placeholder={mode === 'NOTE' ? 'Write a note only your team can see' : 'Write a reply'}
              aria-label="Message"
              className="min-h-20 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ctrl or Cmd + Enter to send</span>
              <Button onClick={() => void send()} disabled={sending || !text.trim() || (Boolean(disabledReason) && mode !== 'NOTE')}>
                {sending ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneRight size={16} />}
                {mode === 'NOTE' ? 'Add note' : 'Send'}
              </Button>
            </div>
          </div>
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
                    <AvatarFallback className="text-[0.6875rem]">{initials(p.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{p.username ? `@${p.username}` : 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.replyOptions.dmMode === 'DM'
                        ? 'Can message now'
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
