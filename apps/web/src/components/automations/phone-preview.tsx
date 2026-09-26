'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import {
  CaretLeft,
  Camera,
  File as FileIcon,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  Microphone,
  Phone,
  Smiley,
  VideoCamera,
} from '@phosphor-icons/react';
import type { MediaKind } from '@/lib/api';
import type { ActionStepNode } from '@/components/automations/action-step-editor';

const MEDIA_ICON: Record<MediaKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  file: FileIcon,
};

// Sample values only, so merge tags read naturally in the preview. Real
// values are resolved server-side when the message is sent.
function renderSample(text: string): string {
  return text
    .replace(/\{\{username\}\}/g, 'alex')
    .replace(/\{\{full_name\}\}/g, 'Alex Rivera')
    .replace(/\{\{field\.([^}]+)\}\}/g, '[$1]');
}

export interface PreviewMessage {
  id: string;
  text: string;
  buttons: string[];
  media?: { type: MediaKind; filename: string } | null;
}

/** The DM bubbles a list of steps would send, with merge tags shown as sample values. */
export function stepsToMessages(steps: ActionStepNode[]): PreviewMessage[] {
  return steps
    .filter((s) => s.type === 'SEND_DM')
    .map((m) => ({
      id: m.id,
      text: renderSample(m.text).trim(),
      buttons: m.media ? [] : m.buttons.map((b) => b.title || 'Button'),
      media: m.media ? { type: m.media.type, filename: m.media.filename } : null,
    }));
}

export { renderSample };

interface PhonePreviewProps {
  accountName: string;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  /** Static preview of these steps. Ignored when `messages` is given. */
  steps?: ActionStepNode[];
  /** Explicit bubbles, used by the animated demo. */
  messages?: PreviewMessage[];
  /** Shows the "typing" bubble after the last message. */
  typing?: boolean;
  className?: string;
}

// Laid out like an Instagram DM thread as seen by the person who commented:
// the business's messages arrive on the left with its avatar.
export function PhonePreview({ accountName, displayName, profilePictureUrl, steps = [], messages: given, typing = false, className }: PhonePreviewProps) {
  const reduce = useReducedMotion();
  // Instagram CDN URLs expire; fall back to the initial instead of a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(profilePictureUrl) && failedUrl !== profilePictureUrl;
  const messages = given ?? stepsToMessages(steps);
  const initial = (accountName.replace('@', '')[0] ?? 'C').toUpperCase();

  const avatar = (size: string) => (
    <span
      className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[0.6875rem] font-semibold text-foreground`}
    >
      {showPhoto && profilePictureUrl ? (
        <Image
          src={profilePictureUrl}
          alt={`${accountName} profile picture`}
          fill
          sizes="40px"
          unoptimized
          referrerPolicy="no-referrer"
          className="object-cover"
          onError={() => setFailedUrl(profilePictureUrl)}
        />
      ) : (
        initial
      )}
    </span>
  );

  return (
    <div className={`mx-auto w-full max-w-[320px] rounded-[2.75rem] border border-border bg-card p-1 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] ${className ?? 'xl:sticky xl:top-20'}`}>
      <div className="relative flex h-[580px] flex-col overflow-hidden rounded-[2.5rem] bg-background">
        <span className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />

        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-9">
          <CaretLeft size={22} className="shrink-0 text-foreground" aria-hidden />
          {avatar('size-8')}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">{displayName || accountName || 'Your account'}</p>
            <p className="truncate text-xs text-muted-foreground">{accountName.replace('@', '') || 'username'}</p>
          </div>
          <Phone size={22} className="shrink-0 text-foreground" aria-hidden />
          <VideoCamera size={24} className="shrink-0 text-foreground" aria-hidden />
        </div>

        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <p className="m-auto text-center text-xs text-muted-foreground">
              Add a Send message step to see it here.
            </p>
          )}
          {messages.map((m, i) => {
            const Icon = m.media ? MEDIA_ICON[m.media.type] : null;
            const isLast = i === messages.length - 1 && !typing;
            return (
              <motion.div
                key={m.id}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-end gap-2"
              >
                <span className={isLast ? '' : 'invisible'}>{avatar('size-6')}</span>
                <div className="flex max-w-[78%] flex-col overflow-hidden rounded-[1.375rem] bg-muted text-foreground">
                  {m.media && Icon ? (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm">
                      <Icon size={18} />
                      <span className="truncate">{m.media.filename}</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-snug">
                      {m.text || <span className="text-muted-foreground">Enter your text...</span>}
                    </p>
                  )}
                  {m.buttons.map((b, bi) => (
                    <span key={bi} className="border-t border-background/60 px-3.5 py-2 text-center text-sm font-medium">
                      {b}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {typing && (
            <div className="flex items-end gap-2">
              {avatar('size-6')}
              <div className="flex items-center gap-1 rounded-[1.375rem] bg-muted px-4 py-3" aria-label="Typing">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-1.5 rounded-full bg-muted-foreground"
                    animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 pt-1" aria-hidden>
          <div className="flex items-center gap-2.5 rounded-full border border-border px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Camera size={16} weight="fill" />
            </span>
            <input
              readOnly
              tabIndex={-1}
              placeholder="Message..."
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <Microphone size={20} className="shrink-0 text-foreground" />
            <ImageIcon size={20} className="shrink-0 text-foreground" />
            <Smiley size={20} className="shrink-0 pr-0.5 text-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
