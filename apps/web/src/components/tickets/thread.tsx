'use client';

import { ArrowBendUpLeft, NotePencil, Paperclip, WarningCircle } from '@phosphor-icons/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { TicketHistoryMessage, TicketMessage, TicketParticipant } from '@/lib/api';
import { cn } from '@/lib/cn';
import { initials, participantLabel, timeAgo } from '@/components/tickets/ticket-meta';

export const CHANNEL_LABEL: Record<TicketMessage['channel'], string> = {
  COMMENT: 'Comment',
  DM: 'Direct message',
  PUBLIC_REPLY: 'Public reply',
  NOTE: 'Internal note',
  TAGGED_POST: 'Tagged post',
};

export interface ThreadItem {
  /** The underlying TicketMessage id — null for Instagram-history-only items, which can't be a quote-reply target (no row to point `replyToMessageId` at). */
  id: string | null;
  key: string;
  kind: TicketMessage['kind'];
  channel: TicketMessage['channel'];
  text: string;
  createdAt: string;
  participantId: string | null;
  authorName: string | null;
  status: TicketMessage['status'];
  error: string | null;
  replyToMessage: TicketMessage['replyToMessage'];
  /** True for messages that only exist in Instagram's own thread (before the ticket, or sent from the app). */
  fromInstagram?: boolean;
}

const MATCH_WINDOW_MS = 2 * 60 * 1000;

/** What the composer needs to send a quote-reply — set from a clicked bubble, cleared on send or participant switch. */
export interface ReplyTarget {
  messageId: string;
  authorLabel: string;
  text: string;
}

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
      id: m.id,
      key: `t-${m.id}`,
      kind: m.kind,
      channel: m.channel,
      text: m.text,
      createdAt: m.createdAt,
      participantId: m.participantId,
      authorName: m.author?.name ?? null,
      status: m.status,
      error: m.error,
      replyToMessage: m.replyToMessage,
    };
  });

  for (const h of history) {
    if (used.has(h.id)) continue;
    items.push({
      id: null,
      key: `ig-${h.id}`,
      kind: h.fromCustomer ? 'INBOUND' : 'OUTBOUND',
      channel: 'DM',
      text: h.text || (h.hasAttachment ? '[attachment]' : ''),
      createdAt: h.createdAt,
      participantId,
      authorName: null,
      status: 'SENT',
      error: null,
      replyToMessage: null,
      fromInstagram: true,
    });
  }

  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function ThreadView({
  items,
  participants,
  showRecipient = true,
  onReply,
}: {
  items: ThreadItem[];
  participants: TicketParticipant[];
  /** Whether outgoing messages name who they were sent to (useful with several people). */
  showRecipient?: boolean;
  /** Omitted where quote-replying doesn't make sense (e.g. the ticket overview's condensed thread). */
  onReply?: (target: ReplyTarget) => void;
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
        const authorLabel = outbound ? m.authorName || 'Your team' : p ? participantLabel(p, 'Customer') : 'Customer';
        // Quote-reply is a DM-only Meta capability (Send API reply_to.mid) and needs a real
        // TicketMessage row to point at, so history-only bubbles (m.id === null) can't be targeted.
        const replyable = Boolean(onReply && m.id && m.channel === 'DM' && m.status !== 'FAILED');
        return (
          <div key={m.key} className={cn('group flex gap-3', outbound && 'flex-row-reverse')}>
            <Avatar className="size-8 shrink-0">
              {!outbound && p?.profilePictureUrl && <AvatarImage src={p.profilePictureUrl} alt="" />}
              <AvatarFallback className="text-[0.6875rem]">{outbound ? initials(m.authorName, 'Y') : initials(p ? p.name || p.username : null, '?')}</AvatarFallback>
            </Avatar>
            <div className={cn('flex max-w-[80%] flex-col gap-1', outbound && 'items-end')}>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {authorLabel}
                {', '}
                {CHANNEL_LABEL[m.channel]}
                {outbound && showRecipient && p ? ` to ${participantLabel(p)}` : ''}, {timeAgo(m.createdAt)}
                {replyable && (
                  <button
                    type="button"
                    onClick={() => onReply?.({ messageId: m.id as string, authorLabel, text: m.text })}
                    className="rounded-full p-1 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label="Reply to this message"
                  >
                    <ArrowBendUpLeft size={12} />
                  </button>
                )}
              </p>
              <div
                className={cn(
                  'flex flex-col gap-1 rounded-2xl px-4 py-2.5 text-sm',
                  outbound ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground',
                  m.status === 'FAILED' && 'opacity-60',
                )}
              >
                {m.replyToMessage && (
                  <p
                    className={cn(
                      'truncate border-l-2 pl-2 text-xs',
                      outbound ? 'border-accent-foreground/30 text-accent-foreground/70' : 'border-foreground/20 text-muted-foreground',
                    )}
                  >
                    {m.replyToMessage.kind === 'OUTBOUND' ? 'You: ' : ''}
                    {m.replyToMessage.text || 'Attachment'}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">
                  {m.text.startsWith('[attachment]') ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Paperclip size={14} />
                      Attachment
                    </span>
                  ) : (
                    m.text
                  )}
                </p>
              </div>
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
