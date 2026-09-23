'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { Avatar } from './avatar';
import { ChatCircleText, Clock, Gift, Link as LinkIcon, PaperPlaneTilt, Tag } from '@phosphor-icons/react';

const EVENTS = [
  { who: '@maya.creates', word: 'PRICE', note: 'Sent your price list', Icon: Tag },
  { who: '@sam.builds', word: 'LINK', note: 'Sent your link', Icon: LinkIcon },
  { who: '@jordan.k', word: 'GUIDE', note: 'Sent your free guide', Icon: Gift },
  { who: '@a.follower', word: 'PRICE', note: 'Sent your price list', Icon: Tag },
  { who: '@lena.fit', word: 'LINK', note: 'Sent your link', Icon: LinkIcon },
];
const ROWS = 5;
const SPRING = { type: 'spring', stiffness: 300, damping: 28 } as const;

/**
 * Example activity list, laid out like a recent-activity panel: an icon tile,
 * what happened, and how long ago. A new row slides in at the top every couple
 * of seconds and the oldest one drops off. Adapted from the layout of Spectrum
 * UI's Recent Activity (spectrumhq.in). Illustrative only.
 */
export function ActivityFeed() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [count, setCount] = useState(ROWS);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setCount((c) => c + 1), 2400);
    return () => clearInterval(t);
  }, [inView, reduce]);

  const rows = Array.from({ length: ROWS }, (_, i) => {
    const n = count - i;
    return { id: n, age: i === 0 ? 'now' : `${i * 2}s`, ...EVENTS[n % EVENTS.length] };
  });

  return (
    <div ref={ref} className="flex h-full min-h-[27rem] flex-col rounded-[calc(2rem-0.375rem)] bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-white/10">
          <PaperPlaneTilt size={14} weight="fill" />
        </span>
        <span className="text-sm font-medium">Every DM, in one list</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative grid size-2 place-items-center">
            {!reduce && (
              <motion.span
                className="absolute size-2 rounded-full bg-success"
                animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            )}
            <span className="size-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      <ul className="mt-6 flex flex-1 flex-col justify-between gap-2.5 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((row, i) => (
            <motion.li
              key={row.id}
              layout
              initial={reduce ? false : { opacity: 0, y: -24, scale: 0.97, filter: 'blur(6px)' }}
              animate={{ opacity: 1 - i * 0.12, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
              transition={SPRING}
              className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white/[0.06] px-3.5 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]"
            >
              {i === 0 && !reduce && (
                <motion.span
                  key={`flash-${row.id}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-white/20"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                />
              )}
              <span className="relative shrink-0">
                <Avatar who={row.who.slice(1)} size={36} />
                <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-accent text-accent-foreground">
                  <row.Icon size={9} weight="bold" />
                </span>
              </span>
              <span className="relative min-w-0 flex-1 text-sm leading-tight">
                <span className="flex items-center gap-1.5 font-medium">
                  {row.who}
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">
                    <ChatCircleText size={10} weight="fill" />
                    {row.word}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.note}</span>
              </span>
              <span className="relative inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
                <Clock size={10} />
                {row.age}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
