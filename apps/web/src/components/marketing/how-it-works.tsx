'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { CheckCircle, ChatCircleText, Eye, PaperPlaneTilt } from '@phosphor-icons/react';

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];
const SPRING = { type: 'spring', stiffness: 260, damping: 22 } as const;

const STEPS = [
  { title: 'Choose what to catch', body: 'A keyword on a comment, a reply to your Story, or a comment while you are live.' },
  { title: 'Convozy keeps watch', body: 'Every comment and reply is checked the second it comes in, day or night.' },
  { title: 'They get an instant reply', body: 'Your message lands in their inbox in seconds. You never lift a finger.' },
];

/** Steps 0..len-1 in a loop while the block is on screen. */
function useLoop(ref: React.RefObject<HTMLElement | null>, len: number, ms: number) {
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % len), ms);
    return () => clearInterval(t);
  }, [inView, reduce, len, ms]);
  return reduce ? len - 1 : i;
}

function Pane({ children, paneRef }: { children: ReactNode; paneRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={paneRef} className="relative flex h-40 flex-col justify-center gap-2 overflow-hidden rounded-2xl bg-white/[0.04] p-4 text-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      {children}
    </div>
  );
}

function KeywordPane() {
  const pane = useRef<HTMLDivElement>(null);
  const i = useLoop(pane, 4, 1300);
  const words = ['Comment', 'Story reply', 'Live comment'];
  return (
    <Pane paneRef={pane}>
      <div className="text-muted-foreground">Catch replies from</div>
      <div className="flex gap-2">
        {words.map((w, n) => (
          <motion.span
            key={w}
            animate={{
              backgroundColor: i % 3 === n && i < 3 ? 'rgba(250,250,250,1)' : 'rgba(250,250,250,0.1)',
              color: i % 3 === n && i < 3 ? '#0a0a0b' : '#fafafa',
              scale: i % 3 === n && i < 3 ? 1.06 : 1,
            }}
            transition={SPRING}
            className="rounded-full px-2.5 py-1.5 font-semibold"
          >
            {w}
          </motion.span>
        ))}
      </div>
      <div className="mt-1 rounded-xl bg-white/10 px-3 py-2 text-muted-foreground">Then: send your DM</div>
    </Pane>
  );
}

function WatchPane() {
  const pane = useRef<HTMLDivElement>(null);
  const i = useLoop(pane, 5, 1100);
  const list = ['Love this!', 'PRICE please', 'Great post', 'link pls'];
  const hit = (n: number) => n === 1 || n === 3;
  return (
    <Pane paneRef={pane}>
      {list.map((t, n) => (
        <motion.div
          key={t}
          animate={{
            backgroundColor: i === n + 1 && hit(n) ? 'rgba(250,250,250,0.95)' : 'rgba(250,250,250,0.08)',
            color: i === n + 1 && hit(n) ? '#0a0a0b' : '#fafafa',
            x: i === n + 1 && hit(n) ? 6 : 0,
          }}
          transition={SPRING}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5"
        >
          <Eye size={12} /> {t}
          {i === n + 1 && hit(n) && <CheckCircle size={12} weight="fill" className="ml-auto" />}
        </motion.div>
      ))}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-white/[0.05] to-transparent"
        animate={{ y: [-80, 170] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
      />
    </Pane>
  );
}

function SendPane() {
  const pane = useRef<HTMLDivElement>(null);
  const i = useLoop(pane, 4, 1400);
  return (
    <Pane paneRef={pane}>
      <div className="relative h-10">
        <motion.span
          className="absolute top-1 grid size-8 place-items-center rounded-full bg-accent text-accent-foreground"
          animate={{ left: i >= 1 ? 'calc(100% - 2rem)' : '0%', rotate: i >= 1 ? 0 : -20 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <PaperPlaneTilt size={16} weight="fill" />
        </motion.span>
        <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>
      <AnimatePresence>
        {i >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-foreground"
          >
            Here is the link you asked for!
          </motion.div>
        )}
      </AnimatePresence>
    </Pane>
  );
}

/**
 * Three-step explainer. Each step's badge turns from a pulsing "in progress" dot into a check in turn,
 * and each card plays a small looping scene. Step progress is based on the
 * layout of Spectrum UI's Agent Steps (running dot, then a popped check).
 */
export function HowItWorks() {
  const reduce = useReducedMotion();
  const section = useRef<HTMLDivElement>(null);
  const inView = useInView(section, { once: true, amount: 0.3 });
  const scenes = [KeywordPane, WatchPane, SendPane];
  const icons = [ChatCircleText, Eye, PaperPlaneTilt];

  return (
    <div ref={section} className="relative">
      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, n) => {
          const Scene = scenes[n];
          const Icon = icons[n];
          const done = reduce || inView;
          return (
            <motion.div
              key={step.title}
              initial={reduce ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, delay: n * 0.12, ease: EASE }}
              className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5"
            >
              <div className="flex h-full flex-col gap-6 rounded-[calc(2rem-0.375rem)] bg-card p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
                <div className="flex items-center gap-3">
                  <span className="relative grid size-11 place-items-center rounded-full bg-white/10">
                    <Icon size={20} weight="bold" />
                    <AnimatePresence mode="wait" initial={false}>
                      {done ? (
                        <motion.span
                          key="done"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ ...SPRING, delay: 0.5 + n * 0.9 }}
                          className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-accent text-accent-foreground"
                        >
                          <CheckCircle size={14} weight="fill" />
                        </motion.span>
                      ) : (
                        <motion.span key="run" className="absolute -bottom-0.5 -right-0.5 size-3 animate-pulse rounded-full bg-white/70" />
                      )}
                    </AnimatePresence>
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                </div>
                <Scene />
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
