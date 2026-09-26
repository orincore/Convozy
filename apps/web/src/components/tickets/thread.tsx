'use client';

import { NotePencil, Paperclip, WarningCircle } from '@phosphor-icons/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { TicketHistoryMessage, TicketMessage, TicketParticipant } from '@/lib/api';
import { cn } from '@/lib/cn';
import { initials, timeAgo } from '@/components/tickets/ticket-meta';

export const CHANNEL_LABEL: Record<TicketMessage['channel'], string> = {
  COMMENT: 'Comment',
  DM: 'Direct message',
  PUBLIC_REPLY: 'Public reply',
  NOTE: 'Internal note',
  TAGGED_POST: 'Tagged post',
};

export interface ThreadItem {
  key: string;
  kind: TicketMessage['kind'];
  channel: TicketMessage['channel'];
  text: string;
  createdAt: string;
  participantId: string | null;
  authorName: string | null;
  status: TicketMessage['status'];
  error: string | null;
  /** True for messages that only exist in Instagram's own thread (before the ticket, or sent from the app). */
  fromInstagram?: boolean;
}

const MATCH_WINDOW_MS = 2 * 60 * 1000;

/**
 * One timeline for a person: the ticket's own messages (comments, public replies,
 * notes, DMs sent here) plus their full Instagram DM thread. A DM that appears in
 * both is shown once, using the ticket's copy because it knows who sent it.
 */
export function buildThread(
  messages: TicketMessage[],
  history: TicketHistoryMessage[],
  participantId: string | null,
): ThreadItem[] {
  const own = messages.filter((m) => participantId === null || m.participantId === participantId || m.kind === 'NOTE');
  const used = new Set<string>();

  const matches = (m: TicketMessage, h: TicketHistoryMessage) =>
    !used.has(h.id) &&
    h.fromCustomer === (m.kind === 'INBOUND') &&
    h.text.trim() === m.text.trim() &&
    Math.abs(new Date(h.createdAt).getTime() - new Date(m.createdAt).getTime()) < MATCH_WINDOW_MS;

  const items: ThreadItem[] = own.map((m) => {
    if (m.channel === 'DM' && m.status === 'SENT') {
      const hit = history.find((h) => matches(m, h));
      if (hit) used.add(hit.id);
    }
    return {
      key: `t-${m.id}`,
      kind: m.kind,
      channel: m.channel,
      text: m.text,
      createdAt: m.createdAt,
      participantId: m.participantId,
      authorName: m.author?.name ?? null,
      status: m.status,
      error: m.error,
    };
  });

  for (const h of history) {
    if (used.has(h.id)) continue;
    items.push({
      key: `ig-${h.id}`,
      kind: h.fromCustomer ? 'INBOUND' : 'OUTBOUND',
      channel: 'DM',
      text: h.text || (h.hasAttachment ? '[attachment]' : ''),
      createdAt: h.createdAt,
      participantId,
      authorName: null,
      status: 'SENT',
      error: null,
      fromInstagram: true,
    });
  }

  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function ThreadView({
  items,
  participants,
  showRecipient = true,
}: {
  items: ThreadItem[];
  participants: TicketParticipant[];
  /** Whether outgoing messages name who they were sent to (useful with several people). */
  showRecipient?: boolean;
}) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  return (
    <>
      {items.map((m) => {
        const p = m.participantId ? byId.get(m.participantId) : undefined;
        if (m.kind === 'NOTE') {
          return (
            <div key={m.key} className="rounded-[var(--radius-control)] border border-dashed border-border bg-muted px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <NotePencil size={13} />
                Internal note by {m.authorName || 'a teammate'}, {timeAgo(m.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{m.text}</p>
            </div>
          );
        }
        const outbound = m.kind === 'OUTBOUND';
        return (
          <div key={m.key} className={cn('flex gap-3', outbound && 'flex-row-reverse')}>
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-[0.6875rem]">{outbound ? initials(m.authorName, 'Y') : initials(p?.username, '?')}</AvatarFallback>
            </Avatar>
            <div className={cn('flex max-w-[80%] flex-col gap-1', outbound && 'items-end')}>
              <p className="text-xs text-muted-foreground">
                {outbound ? m.authorName || 'Your team' : p?.username ? `@${p.username}` : 'Customer'}
                {', '}
                {CHANNEL_LABEL[m.channel]}
                {outbound && showRecipient && p?.username ? ` to @${p.username}` : ''}, {timeAgo(m.createdAt)}
              </p>
              <p
                className={cn(
                  'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm',
                  outbound ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground',
                  m.status === 'FAILED' && 'opacity-60',
                )}
              >
                {m.text.startsWith('[attachment]') ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip size={14} />
                    Attachment
                  </span>
                ) : (
                  m.text
                )}
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
    </>
  );
}
