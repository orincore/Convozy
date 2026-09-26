'use client';

import { useState } from 'react';
import { ChatCircleDots, CircleNotch, LockSimple, PaperPlaneRight, UserSwitch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, TicketDetail, ticketsApi } from '@/lib/api';
import { cn } from '@/lib/cn';

type Mode = 'DM' | 'PUBLIC_REPLY' | 'NOTE';
const MODES: Mode[] = ['DM', 'PUBLIC_REPLY', 'NOTE'];

/**
 * Reply box shared by the ticket page and the full chat page: DM (including a
 * Human Agent reply up to 7 days after their last message, or the one private
 * reply to a comment), public reply, or an internal note.
 */
export function TicketComposer({
  ticket,
  participantId,
  onParticipantChange,
  onSent,
  onError,
}: {
  ticket: TicketDetail;
  participantId: string;
  onParticipantChange?: (id: string) => void;
  onSent: () => void;
  onError: (message: string | null) => void;
}) {
  const [chosenMode, setMode] = useState<Mode>('DM');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const participant = ticket.participants.find((p) => p.id === participantId) ?? ticket.participants[ticket.participants.length - 1];
  const options = participant?.replyOptions;

  const available = (m: Mode): boolean => {
    if (m === 'NOTE') return true;
    if (!options) return false;
    return m === 'DM' ? options.dmMode !== null : options.canPublicReply;
  };
  const mode: Mode = available(chosenMode) ? chosenMode : (MODES.find(available) ?? 'NOTE');

  const label: Record<Mode, string> = {
    DM: options?.dmMode === 'PRIVATE_REPLY' ? 'Private reply' : options?.dmMode === 'HUMAN_AGENT' ? 'Direct message (human agent)' : 'Direct message',
    PUBLIC_REPLY: 'Public reply',
    NOTE: 'Internal note',
  };
  const blocked =
    mode === 'DM' && options?.dmMode === null
      ? options.dmUnavailableReason
      : mode === 'PUBLIC_REPLY' && options && !options.canPublicReply
        ? 'This person has no comment to reply to publicly.'
        : null;

  async function send() {
    const body = text.trim();
    if (!body || !participant) return;
    setSending(true);
    onError(null);
    try {
      if (mode === 'NOTE') await ticketsApi.addNote(ticket.id, body);
      else await ticketsApi.reply(ticket.id, { participantId: participant.id, channel: mode, text: body });
      setText('');
      onSent();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  // When a DM is impossible (past 7 days), a public reply can invite them to write again.
  function askToMessageAgain() {
    setMode('PUBLIC_REPLY');
    setText(`Hi @${participant?.username ?? 'there'}, we'd like to keep helping you. Please send us a DM and we'll continue there.`);
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={!available(m)}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              mode === m ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {label[m]}
          </button>
        ))}
        {ticket.participants.length > 1 && mode !== 'NOTE' && onParticipantChange && (
          <Select
            aria-label="Reply to"
            value={participant?.id ?? ''}
            className="ml-auto h-8 max-w-48 text-xs"
            onChange={(e) => onParticipantChange(e.target.value)}
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
      {mode === 'DM' && options?.dmMode === 'HUMAN_AGENT' && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <UserSwitch size={13} className="mt-px shrink-0" />
          It has been over 24 hours, so this goes out as a Human Agent message, which Instagram allows for up to 7 days after their last message.
          It must be written by a person, not automated.
        </p>
      )}
      {blocked && (
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p className="flex items-start gap-1.5">
            <LockSimple size={13} className="mt-px shrink-0" />
            {blocked}
          </p>
          {mode === 'DM' && options?.canPublicReply && (
            <button type="button" onClick={askToMessageAgain} className="flex w-fit items-center gap-1.5 text-foreground underline underline-offset-2">
              <ChatCircleDots size={13} />
              Ask them to message you again, publicly
            </button>
          )}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send();
        }}
        rows={3}
        maxLength={mode === 'NOTE' ? 4000 : 1000}
        disabled={Boolean(blocked) && mode !== 'NOTE'}
        placeholder={mode === 'NOTE' ? 'Write a note only your team can see' : 'Write a reply'}
        aria-label="Message"
        className="min-h-20 resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ctrl or Cmd + Enter to send</span>
        <Button onClick={() => void send()} disabled={sending || !text.trim() || (Boolean(blocked) && mode !== 'NOTE')}>
          {sending ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneRight size={16} />}
          {mode === 'NOTE' ? 'Add note' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
