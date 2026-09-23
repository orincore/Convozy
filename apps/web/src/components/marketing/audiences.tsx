'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { Avatar } from './avatar';
import { ChatCircleText, CheckCircle, PaperPlaneTilt } from '@phosphor-icons/react';

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];
const SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const;

function useLoop(len: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % len), ms);
    return () => clearInterval(t);
  }, [inView, reduce, len, ms]);
  return { ref, i: reduce ? 0 : i };
}

/** Overlapping avatars that fan apart and lift on hover (after Spectrum UI's Avatar Stack). */
function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="group/stack flex items-center pl-2">
      {names.map((n, i) => (
        <span
          key={n}
          style={{ zIndex: names.length - i }}
          className="-ml-2 transition-[margin,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/stack:ml-0.5 group-hover/stack:-translate-y-0.5 group-hover/stack:first:ml-0"
        >
          <Avatar who={n} size={32} className="ring-2 ring-card" />
        </span>
      ))}
    </div>
  );
}

function Panel({
  title,
  body,
  soon,
  children,
}: {
  title: string;
  body: string;
  soon?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="h-full rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
      <div className="flex h-full flex-col gap-6 rounded-[calc(2rem-0.375rem)] bg-card p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
        <div className="relative h-52 overflow-hidden rounded-2xl bg-white/[0.04] p-4 text-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          {children}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
            {soon && (
              <span className="max-w-[55%] shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-right text-[0.6875rem] leading-tight text-muted-foreground">
                Coming soon, like the second date
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

function CreatorScene() {
  const { ref, i } = useLoop(4, 1500);
  return (
    <div ref={ref} className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Your followers</span>
        <AvatarStack names={['maya.creates', 'jordan.k', 'sam.builds', 'lena.fit']} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-white/10 px-3 py-2">
          <ChatCircleText size={12} /> PRICE please!
        </div>
        <AnimatePresence>
          {i >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="ml-auto flex w-fit items-center gap-2 rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-foreground"
            >
              <PaperPlaneTilt size={12} weight="fill" /> Here are the prices!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const QUERIES = [
  { name: 'Order question', tag: 'Support', who: 'order.q' },
  { name: 'Price request', tag: 'Sales', who: 'price.q' },
  { name: 'Collab idea', tag: 'Partners', who: 'collab.q' },
];

function BrandScene() {
  const { ref, i } = useLoop(3, 1500);
  return (
    <div ref={ref} className="flex h-full flex-col gap-2">
      <div className="text-muted-foreground">Messages from customers</div>
      {QUERIES.map((q, n) => (
        <motion.div
          key={q.name}
          animate={{ backgroundColor: i === n ? 'rgba(250,250,250,0.16)' : 'rgba(250,250,250,0.06)', x: i === n ? 4 : 0 }}
          transition={SPRING}
          className="flex items-center gap-2 rounded-xl px-3 py-2"
        >
          <Avatar who={q.who} size={22} />
          <span className="font-medium">{q.name}</span>
          <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">{q.tag}</span>
          {i === n && <CheckCircle size={14} weight="fill" className="text-success" />}
        </motion.div>
      ))}
    </div>
  );
}

const CLIENTS = [
  { name: 'Bloom Cafe', people: ['Anna', 'Leo', 'Ivy'] },
  { name: 'Fit With Kai', people: ['Kai', 'Zoe', 'Max'] },
  { name: 'Studio North', people: ['Eli', 'Nia', 'Sol'] },
];

function AgencyScene() {
  const { ref, i } = useLoop(3, 1800);
  return (
    <div ref={ref} className="flex h-full flex-col gap-3">
      <div className="relative flex gap-1 rounded-full bg-white/[0.06] p-1">
        {CLIENTS.map((c, n) => (
          <span key={c.name} className="relative flex-1 rounded-full px-2 py-1.5 text-center text-[10px] font-semibold">
            {n === i && <motion.span layoutId="agency-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-accent" />}
            <span className={`relative ${n === i ? 'text-accent-foreground' : 'text-muted-foreground'}`}>{c.name}</span>
          </span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex flex-col gap-1.5"
        >
          {CLIENTS[i].people.map((p) => (
            <div key={p} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-1.5">
              <Avatar who={p} size={22} />
              {p}
              <span className="ml-auto text-muted-foreground">New message</span>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Who Convozy is for: creators, brands and agencies. Each panel plays a small
 * scene. Avatar stack fans on hover (Spectrum UI Avatar Stack pattern); the
 * brand list highlights the active conversation (Conversation List pattern).
 * The agency panel is marked Coming soon: shared team CRM is planned, not built.
 */
export function Audiences() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {[
        {
          title: 'Creators',
          body: 'Answer every comment and DM without typing, and keep growing while you create.',
          scene: <CreatorScene />,
        },
        {
          title: 'Brands',
          body: 'Turn customer questions into quick replies, and keep every conversation organised.',
          scene: <BrandScene />,
        },
        {
          title: 'Agencies',
          body: 'Manage DMs and questions for many brands and creator profiles from one CRM.',
          scene: <AgencyScene />,
          soon: true,
        },
      ].map((a, n) => (
        <motion.div
          key={a.title}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.9, delay: n * 0.1, ease: EASE }}
        >
          <Panel title={a.title} body={a.body} soon={a.soon}>
            {a.scene}
          </Panel>
        </motion.div>
      ))}
    </div>
  );
}
