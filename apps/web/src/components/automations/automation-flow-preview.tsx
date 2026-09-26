'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowClockwise, CheckCircle, Circle, EyeSlash, ImageSquare, Lightning, Timer } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { PhonePreview, renderSample, stepsToMessages, type PreviewMessage } from '@/components/automations/phone-preview';
import type { ActionStepNode } from '@/components/automations/action-step-editor';
import type { TriggerSource } from '@/lib/api';

type Beat =
  | { kind: 'trigger'; source: TriggerSource; text: string }
  | { kind: 'publicReply'; text: string }
  | { kind: 'hide' }
  | { kind: 'condition'; label: string }
  | { kind: 'dm'; message: PreviewMessage; delay: number };

const SOURCE_LABEL: Record<TriggerSource, string> = {
  COMMENT: 'comments on your post',
  LIVE_COMMENT: 'comments on your live',
  STORY_REPLY: 'replies to your story',
  STORY_MENTION: 'mentions your account in a story',
  DM: 'sends you a message',
  REFERRAL: 'opens a chat from your link or ad',
};

const COMMENT_SOURCES: TriggerSource[] = ['COMMENT', 'LIVE_COMMENT'];

function triggerSampleText(source: TriggerSource, keyword: string): string {
  if (source === 'STORY_MENTION') return 'Mentioned your account in their story';
  if (source === 'REFERRAL') return keyword ? `Opened your link (ref: ${keyword})` : 'Opened a chat from your link';
  return keyword || 'Hi!';
}

function conditionLabel(node: ActionStepNode): string {
  const field = node.conditionField === 'SENDER_USERNAME' ? 'username' : 'comment';
  const kw = node.conditionKeywords.split(',')[0]?.trim();
  return kw ? `If the ${field} contains "${kw}"` : `If the ${field} matches`;
}

/** Flattens the steps into the order things visibly happen. A condition follows its THEN branch. */
function flatten(steps: ActionStepNode[], out: Beat[]): void {
  for (const node of steps) {
    if (node.type === 'CONDITION') {
      out.push({ kind: 'condition', label: conditionLabel(node) });
      flatten(node.then, out);
    } else if (node.type === 'HIDE_COMMENT') {
      out.push({ kind: 'hide' });
    } else if (node.type === 'REPLY_COMMENT') {
      out.push({ kind: 'publicReply', text: renderSample(node.text).trim() });
    } else if (node.type === 'SEND_DM') {
      const [message] = stepsToMessages([node]);
      out.push({ kind: 'dm', message, delay: Number(node.delaySeconds) || 0 });
    }
  }
}

export function buildBeats(source: TriggerSource, keyword: string, steps: ActionStepNode[]): Beat[] {
  const beats: Beat[] = [{ kind: 'trigger', source, text: triggerSampleText(source, keyword) }];
  flatten(steps, beats);
  return beats;
}

function describe(beat: Beat): string {
  switch (beat.kind) {
    case 'trigger':
      return `Someone ${SOURCE_LABEL[beat.source]}`;
    case 'publicReply':
      return 'Replies publicly under the comment';
    case 'hide':
      return 'Hides the comment';
    case 'condition':
      return `${beat.label}, do this`;
    case 'dm':
      return beat.delay > 0 ? `Waits ${beat.delay}s, then sends a message` : 'Sends a message';
  }
}

interface FlowPreviewProps {
  accountName: string;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  source: TriggerSource;
  keyword: string;
  steps: ActionStepNode[];
}

/**
 * A scripted run of the automation: the trigger arrives, then each step plays
 * in order, exactly as the recipient would see it. Uses sample values (the
 * commenter is "alex"); real merge-tag values are filled in when it sends.
 */
export function AutomationFlowPreview({ accountName, displayName, profilePictureUrl, source, keyword, steps }: FlowPreviewProps) {
  const reduce = useReducedMotion();
  const beats = useMemo(() => buildBeats(source, keyword, steps), [source, keyword, steps]);
  const signature = JSON.stringify(beats);

  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const done = shown >= beats.length;

  useEffect(() => {
    let cancelled = false;
    // The effect is keyed on the serialized beats, so it reads them back from there.
    const list = JSON.parse(signature) as Beat[];
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    (async () => {
      if (reduce) {
        setShown(list.length);
        setTyping(false);
        return;
      }
      setShown(0);
      setTyping(false);
      await wait(500);
      for (let k = 0; k < list.length; k++) {
        if (cancelled) return;
        const beat = list[k];
        if (beat.kind === 'dm') {
          if (beat.delay > 0) {
            setNote(`Waiting ${beat.delay}s (sped up here)`);
            await wait(800);
            if (cancelled) return;
            setNote(null);
          }
          setTyping(true);
          await wait(1000);
        } else {
          await wait(850);
        }
        if (cancelled) return;
        setTyping(false);
        setShown(k + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature, runId, reduce]);

  const visible = beats.slice(0, shown);
  const trigger = beats[0] as Extract<Beat, { kind: 'trigger' }>;
  const isCommentSource = COMMENT_SOURCES.includes(source);
  const hidden = visible.some((b) => b.kind === 'hide');
  const publicReplies = visible.filter((b): b is Extract<Beat, { kind: 'publicReply' }> => b.kind === 'publicReply');
  const conditions = visible.filter((b): b is Extract<Beat, { kind: 'condition' }> => b.kind === 'condition');
  const dmMessages = visible.filter((b): b is Extract<Beat, { kind: 'dm' }> => b.kind === 'dm').map((b, i) => ({ ...b.message, id: `${b.message.id}-${i}` }));
  const username = 'alex';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            A sample run with a made-up person. Nothing is sent.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setRunId((r) => r + 1)}>
            <ArrowClockwise size={14} />
            Replay
          </Button>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Lightning size={13} />
            {isCommentSource ? `Your post as @${accountName.replace('@', '') || 'you'}` : 'What comes in'}
          </p>

          {isCommentSource ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex h-24 items-center justify-center rounded-[var(--radius-control)] bg-muted text-muted-foreground">
                <ImageSquare size={28} />
              </div>
              {shown > 0 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: hidden ? 0.35 : 1, y: 0 }}
                  className="flex flex-col gap-2"
                >
                  <p className="text-sm">
                    <span className="font-semibold">{username}</span> {trigger.text}
                    {hidden && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <EyeSlash size={12} />
                        hidden
                      </span>
                    )}
                  </p>
                  {publicReplies.map((r, i) => (
                    <motion.p
                      key={i}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="ml-6 border-l border-border pl-3 text-sm"
                    >
                      <span className="font-semibold">{accountName.replace('@', '') || 'you'}</span> {r.text || '...'}
                    </motion.p>
                  ))}
                </motion.div>
              )}
            </div>
          ) : (
            shown > 0 && (
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-2xl bg-muted px-4 py-2.5 text-sm"
              >
                <span className="font-semibold">{username}</span> {SOURCE_LABEL[source]}: {trigger.text}
              </motion.p>
            )
          )}
          {shown === 0 && <p className="mt-3 text-sm text-muted-foreground">Waiting for someone to trigger it...</p>}
          {note && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer size={13} />
              {note}
            </p>
          )}
          {conditions.map((c, i) => (
            <p key={i} className="mt-2 text-xs text-muted-foreground">
              {c.label}: taking that path in this run
            </p>
          ))}
        </div>

        <ol className="flex flex-col gap-2" aria-label="What happens, in order">
          {beats.map((b, i) => {
            const on = i < shown;
            return (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                {on ? <CheckCircle size={16} weight="fill" className="text-success" /> : <Circle size={16} className="text-muted-foreground" />}
                <span className={on ? 'text-foreground' : 'text-muted-foreground'}>{describe(b)}</span>
              </li>
            );
          })}
        </ol>
        {done && <p className="text-xs text-muted-foreground">That is the whole run. Replay it any time.</p>}
      </div>

      <PhonePreview
        accountName={accountName}
        displayName={displayName}
        profilePictureUrl={profilePictureUrl}
        messages={dmMessages}
        typing={typing}
        className="lg:sticky lg:top-24"
      />
    </div>
  );
}
