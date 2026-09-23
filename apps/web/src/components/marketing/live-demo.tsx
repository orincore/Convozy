'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ChatCircleText, CheckCircle, PaperPlaneTilt, Target } from '@phosphor-icons/react';

const KEYWORDS = [
  { word: 'PRICE', comment: 'PRICE please, how much is it?', reply: 'Hey! Here are the prices: convozy.orincore.com/example' },
  { word: 'LINK', comment: 'LINK? I would love to try this', reply: 'Here is the link you asked for: convozy.orincore.com/example' },
  { word: 'GUIDE', comment: 'GUIDE me, I am just starting out', reply: 'Here is your free guide: convozy.orincore.com/example' },
];

type Stage = 'typing' | 'matched' | 'sent';
const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];
const SPRING = { type: 'spring', stiffness: 260, damping: 22 } as const;

/**
 * Interactive example: pick a keyword and watch a comment become a DM in
 * three linked steps. Plays on its own when on screen and loops through the
 * keywords; tapping a keyword takes over. Everything is an illustration.
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
  const typingMs = active.comment.length * 38;
  const loopMs = typingMs + 5200;

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
    timers.push(setTimeout(() => setStage('matched'), typingMs + 350));
    timers.push(setTimeout(() => setStage('sent'), typingMs + 1250));
    if (!manual) timers.push(setTimeout(() => go((index + 1) % KEYWORDS.length), loopMs));
    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [index, inView, manual, reduce, active.comment.length, typingMs, loopMs]);

  const matched = shownStage !== 'typing';
  const sent = shownStage === 'sent';

  return (
    <div ref={ref} className="flex h-full min-h-[27rem] flex-col rounded-[calc(2rem-0.375rem)] bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">Pick a keyword</span>
        <div className="relative flex gap-1 rounded-full bg-white/[0.06] p-1" role="tablist" aria-label="Keyword">
          {KEYWORDS.map((k, i) => (
            <button
              key={k.word}
              role="tab"
              aria-selected={i === index}
              onClick={() => {
                setManual(true);
                go(i);
              }}
              className="relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {i === index && (
                <motion.span
                  layoutId="kw-pill"
                  transition={SPRING}
                  className="absolute inset-0 rounded-full bg-accent"
                />
              )}
              <span className={`relative ${i === index ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
                {k.word}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-8 flex flex-1 flex-col gap-6 pl-11">
        <div className="absolute bottom-3 left-[15px] top-3 w-px bg-white/10" aria-hidden="true" />
        <motion.div
          aria-hidden="true"
          className="absolute left-[15px] top-3 w-px origin-top bg-gradient-to-b from-white to-white/40"
          style={{ height: 'calc(100% - 1.5rem)' }}
          initial={false}
          animate={{ scaleY: sent ? 1 : matched ? 0.5 : 0.05 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}
        />

        <Step icon={<ChatCircleText size={16} weight="bold" />} lit label="A follower comments">
          <div className="min-h-[3rem] rounded-2xl rounded-tl-md bg-white/[0.07] px-4 py-3 text-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            <span className="font-medium">@a.follower</span> <span>{active.comment.slice(0, shownTyped)}</span>
            {shownStage === 'typing' && !reduce && (
              <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
            )}
          </div>
        </Step>

        <Step icon={<Target size={16} weight="bold" />} lit={matched} label="Convozy spots your keyword">
          <div className="flex h-9 items-center">
            <AnimatePresence>
              {matched && (
                <motion.span
                  key={active.word}
                  initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={SPRING}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium"
                >
                  <CheckCircle size={14} weight="fill" className="text-success" />
                  Keyword found: <span className="font-semibold">{active.word}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </Step>

        <Step icon={<PaperPlaneTilt size={16} weight="fill" />} lit={sent} label="Your DM goes out">
          <div className="min-h-[3.5rem]">
            <AnimatePresence mode="wait">
              {sent && (
                <motion.div
                  key={active.word}
                  initial={{ opacity: 0, y: 12, scale: 0.96, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                  className="relative w-fit max-w-full overflow-hidden rounded-2xl rounded-bl-md bg-gradient-to-br from-white to-white/80 px-4 py-3 text-sm text-accent-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_18px_50px_-16px_rgba(250,250,250,0.4)]"
                >
                  {!reduce && (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                      animate={{ x: ['0%', '400%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
                    />
                  )}
                  {active.reply}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Step>
      </div>

      {!manual && !reduce && (
        <div className="mt-6 h-0.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <motion.div
            key={`${index}-${inView}`}
            className="h-full origin-left rounded-full bg-white/60"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: inView ? 1 : 0 }}
            transition={{ duration: loopMs / 1000, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
}

function Step({
  icon,
  lit,
  label,
  children,
}: {
  icon: React.ReactNode;
  lit: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{
          backgroundColor: lit ? 'rgba(250,250,250,1)' : 'rgba(40,40,44,1)',
          color: lit ? '#0a0a0b' : '#a1a1aa',
          scale: lit ? 1 : 0.92,
        }}
        transition={SPRING}
        className="absolute -left-11 top-0 grid size-8 place-items-center rounded-full ring-1 ring-white/15"
      >
        {icon}
      </motion.span>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
