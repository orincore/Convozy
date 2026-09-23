'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { PaperPlaneTilt } from '@phosphor-icons/react';

const EVENTS = [
  { who: '@a.follower', word: 'PRICE', note: 'Sent your price list' },
  { who: '@b.follower', word: 'LINK', note: 'Sent your link' },
  { who: '@c.follower', word: 'GUIDE', note: 'Sent your free guide' },
  { who: '@d.follower', word: 'PRICE', note: 'Sent your price list' },
  { who: '@e.follower', word: 'LINK', note: 'Sent your link' },
];

/**
 * Example activity list: new rows slide in on a timer while the panel is on
 * screen, oldest rows drop off. Illustrative only.
 */
export function ActivityFeed() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setCount((c) => c + 1), 2200);
    return () => clearInterval(t);
  }, [inView, reduce]);

  const rows = Array.from({ length: 4 }, (_, i) => count - i).map((n) => ({
    id: n,
    ...EVENTS[n % EVENTS.length],
  }));

  return (
    <div ref={ref} className="rounded-[var(--radius-card)] border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Every DM, in one list</span>
      </div>
      <ul className="mt-5 flex flex-col gap-2 overflow-hidden">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.li
              key={row.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-2.5 text-sm"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <PaperPlaneTilt size={14} weight="fill" />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{row.who}</span>{' '}
                <span className="text-muted-foreground">commented</span>{' '}
                <span className="font-semibold">{row.word}</span>
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {row.note}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
