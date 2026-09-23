'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ChatCircleText, CheckCircle, PaperPlaneTilt } from '@phosphor-icons/react';

const KEYWORDS = [
  { word: 'PRICE', comment: 'PRICE please, how much is it?', reply: 'Hey! Here are the prices: convozy.orincore.com/example' },
  { word: 'LINK', comment: 'LINK? I would love to try this', reply: 'Here is the link you asked for: convozy.orincore.com/example' },
  { word: 'GUIDE', comment: 'GUIDE me, I am just starting out', reply: 'Here is your free guide: convozy.orincore.com/example' },
];

type Stage = 'typing' | 'matched' | 'sent';

/**
 * Interactive example: pick a keyword and watch a comment turn into a DM.
 * Plays on its own when scrolled into view and loops through the keywords.
 * Everything shown is an illustrative example, and is labeled as one.
 */
export function LiveDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState<Stage>('typing');
  const [manual, setManual] = useState(false);

  const active = KEYWORDS[index];
  const shownTyped = reduce ? active.comment.length : typed;
  const shownStage: Stage = reduce ? 'sent' : stage;

  function go(next: number) {
    setTyped(0);
    setStage('typing');
    setIndex(next);
  }

  useEffect(() => {
    if (!inView || reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const interval = setInterval(() => {
      setTyped((n) => {
        if (n >= active.comment.length) {
          clearInterval(interval);
          return n;
        }
        return n + 1;
      });
    }, 38);
    const typingMs = active.comment.length * 38;
    timers.push(setTimeout(() => setStage('matched'), typingMs + 350));
    timers.push(setTimeout(() => setStage('sent'), typingMs + 1250));
    if (!manual) {
      timers.push(setTimeout(() => go((index + 1) % KEYWORDS.length), typingMs + 4500));
    }
    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
    }, [index, inView, manual, reduce, active.comment.length]);

  return (
    <div
      ref={ref}
      className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Pick a keyword</span>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Keyword">
          {KEYWORDS.map((k, i) => (
            <button
              key={k.word}
              role="tab"
              aria-selected={i === index}
              onClick={() => {
                setManual(true);
                go(i);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-[background-color,color,transform] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                i === index
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {k.word}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ChatCircleText size={16} weight="bold" />
        New comment on your post
      </div>
      <div className="mt-2 min-h-[3rem] rounded-xl bg-muted px-4 py-3 text-sm">
        <span className="font-medium">@a.follower</span>{' '}
        <span>{active.comment.slice(0, shownTyped)}</span>
        {shownStage === 'typing' && !reduce && (
          <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
        )}
      </div>

      <div className="mt-4 flex h-6 items-center gap-2 text-xs font-medium text-muted-foreground">
        <AnimatePresence mode="wait">
          {shownStage === 'matched' && (
            <motion.span
              key="m"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1.5"
            >
              <CheckCircle size={16} weight="fill" className="text-success" />
              Keyword found, sending a DM
            </motion.span>
          )}
          {shownStage === 'sent' && (
            <motion.span
              key="s"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1.5"
            >
              <PaperPlaneTilt size={16} weight="bold" />
              DM sent automatically
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 min-h-[3.5rem]">
        <AnimatePresence mode="wait">
          {shownStage === 'sent' && (
            <motion.div
              key={active.word}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-accent-foreground"
            >
              {active.reply}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
