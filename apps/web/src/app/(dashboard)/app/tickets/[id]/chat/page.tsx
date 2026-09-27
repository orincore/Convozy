'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, CircleNotch, Info } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ApiError, TicketDetail, TicketHistoryMessage, ticketsApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useTicketStream } from '@/lib/ticket-stream';
import { StatusBadge, initials, participantLabel } from '@/components/tickets/ticket-meta';
import { TicketComposer } from '@/components/tickets/composer';
import { ThreadView, buildThread } from '@/components/tickets/thread';

/** Full conversation with one person: their whole Instagram DM history plus this ticket's comments, replies and notes. */
export default function TicketChatPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [history, setHistory] = useState<Record<string, TicketHistoryMessage[] | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastKey = useRef('');

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

  const active = ticket?.participants.find((p) => p.id === participantId) ?? ticket?.participants[ticket.participants.length - 1];
  const activeId = active?.id;

  const loadHistory = useCallback(
    (pid: string) => {
      ticketsApi
        .history(id, pid)
        .then((h) => setHistory((prev) => ({ ...prev, [pid]: h.available ? h.messages : null })))
        .catch(() => setHistory((prev) => ({ ...prev, [pid]: null })));
    },
    [id],
  );
  useEffect(() => {
    if (activeId) loadHistory(activeId);
  }, [activeId, loadHistory]);

  const live = useTicketStream((e) => {
    if (e.ticketId !== id) return;
    load();
    if (activeId) loadHistory(activeId);
  });
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load();
        if (activeId) loadHistory(activeId);
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [load, loadHistory, activeId]);

  const igHistory = activeId ? history[activeId] : undefined;
  const thread = useMemo(
    () => buildThread(ticket?.messages ?? [], igHistory ?? [], activeId ?? null),
    [ticket?.messages, igHistory, activeId],
  );

  useEffect(() => {
    const last = thread[thread.length - 1];
    const key = `${activeId}:${thread.length}:${last?.key}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [thread, activeId]);

  async function toggleResolved() {
    if (!ticket) return;
    const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    setActionError(null);
    try {
      setTicket(await ticketsApi.update(id, { status: closed ? 'OPEN' : 'RESOLVED' }));
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

  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  const multiParticipant = ticket.participants.length > 1;

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[32rem] w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/app/tickets/${ticket.id}`}
            className="flex shrink-0 items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to ticket"
          >
            <ArrowLeft size={16} />
          </Link>
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-xs">{initials(active ? active.name || active.username : null)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{active ? participantLabel(active) : 'Unknown'}</h1>
            <p className="truncate text-xs text-muted-foreground">
              Ticket #{ticket.number} · {ticket.subject}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', live === 'live' ? 'bg-success' : 'bg-muted-foreground')} />
            {live === 'live' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Reconnecting'}
          </span>
          <StatusBadge status={ticket.status} />
          <Button variant={closed ? 'outline' : 'primary'} onClick={() => void toggleResolved()}>
            {!closed && <CheckCircle size={16} />}
            {closed ? 'Reopen' : 'Mark resolved'}
          </Button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="mb-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {actionError}
        </p>
      )}

      {/* Most tickets are a 1:1 conversation — the People switcher only earns
       * its space (and the chat its narrower width) when there's actually
       * more than one participant to switch between. */}
      <div className={cn('grid min-h-0 flex-1 gap-4', multiParticipant ? 'grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)]' : 'grid-cols-1')}>
        {multiParticipant && (
          <nav aria-label="People" className="flex gap-2 overflow-x-auto md:flex-col md:overflow-y-auto">
            {ticket.participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setParticipantId(p.id)}
                aria-current={p.id === activeId}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm transition-colors',
                  p.id === activeId ? 'border-accent bg-card' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-[0.625rem]">{initials(p.name || p.username)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{participantLabel(p)}</span>
              </button>
            ))}
          </nav>
        )}

        <section aria-label="Conversation" className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-5">
            {igHistory === null && (
              <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Info size={14} className="mt-px shrink-0" />
                Instagram&apos;s earlier direct messages with this person could not be loaded, so only this ticket&apos;s messages are shown.
              </p>
            )}
            {igHistory === undefined && activeId && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleNotch size={13} className="animate-spin" />
                Loading the full Instagram conversation
              </p>
            )}
            <ThreadView items={thread} participants={ticket.participants} showRecipient={false} />
            <div ref={end} />
          </div>
          <Separator />
          <div className="mx-auto w-full max-w-3xl">
            <TicketComposer
              ticket={ticket}
              participantId={activeId ?? ''}
              onParticipantChange={setParticipantId}
              onSent={() => {
                load();
                if (activeId) loadHistory(activeId);
              }}
              onError={setActionError}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
