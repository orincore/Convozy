'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Avatar } from './avatar';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import {
  ArrowsSplit,
  Bell,
  ChartBar,
  CheckCircle,
  Clock,
  EyeSlash,
  Heart,
  Image as ImageIcon,
  Lightning,
  PaperPlaneTilt,
  Robot,
  Tag,
  UserCircle,
} from '@phosphor-icons/react';

/** Steps through 0..len-1 while on screen; jumps to the end state under reduced motion. */
function useCycle(len: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % len), ms);
    return () => clearInterval(t);
  }, [inView, reduce, len, ms]);
  return { ref, i: reduce ? len - 1 : i };
}

const SPRING = { type: 'spring', stiffness: 260, damping: 22 } as const;
const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

function Stage({ stageRef, children }: { stageRef: React.Ref<HTMLDivElement>; children: ReactNode }) {
  return (
    <div
      ref={stageRef}
      className="relative flex h-44 flex-col justify-center gap-2 overflow-hidden rounded-2xl bg-white/[0.04] p-4 text-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
    >
      {children}
    </div>
  );
}

function Show({ when, children, className }: { when: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {when && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={SPRING}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function In({ children }: { children: ReactNode }) {
  return <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2">{children}</div>;
}
function Out({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-foreground">
      {children}
    </div>
  );
}
function Pill({ children, on }: { children: ReactNode; on?: boolean }) {
  return (
    <motion.span
      animate={{ backgroundColor: on ? 'rgba(250,250,250,0.95)' : 'rgba(250,250,250,0.1)', color: on ? '#0a0a0b' : '#fafafa' }}
      transition={{ duration: 0.4 }}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
    >
      {children}
    </motion.span>
  );
}

/* ---------- live features ---------- */

export function StoryReplyVisual() {
  const { ref, i } = useCycle(5, 1500);
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-white/40 to-white/5 ring-2 ring-white/30">
          <UserCircle size={16} />
        </span>
        Someone replies to your Story
      </div>
      <Show when={i >= 1}><In>Where can I get this?</In></Show>
      <Show when={i >= 3}><Out>Here you go! Link inside.</Out></Show>
    </Stage>
  );
}

export function LiveCommentVisual() {
  const { ref, i } = useCycle(8, 1100);
  const feed = ['PRICE?', 'link pls', 'GUIDE', 'love this', 'PRICE', 'how much'];
  const viewers = ['viewer.1', 'viewer.2', 'viewer.3', 'a.follower', 'lena.fit', 'sam.builds', 'jordan.k', 'maya.creates'];
  const rows = [0, 1, 2].map((k) => ({ id: i - k, who: viewers[Math.abs(i - k) % viewers.length], text: feed[Math.abs(i - k) % feed.length], age: k === 0 ? 'now' : `${k * 2}s` }));
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center gap-2 font-semibold">
        <span className="relative grid size-3 place-items-center">
          <motion.span animate={{ scale: [1, 2.4], opacity: [0.6, 0] }} transition={{ duration: 1.4, repeat: Infinity }} className="absolute size-2 rounded-full bg-danger" />
          <span className="size-2 rounded-full bg-danger" />
        </span>
        LIVE
        <span className="ml-auto font-normal text-muted-foreground">Recent activity</span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((r) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: -18, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 14 }}
              transition={SPRING}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5"
            >
              <Avatar who={r.who} size={18} />
              <span className="font-medium">{r.text}</span>
              <span className="ml-auto text-muted-foreground">{r.age}</span>
              <PaperPlaneTilt size={12} weight="fill" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Stage>
  );
}

export function PostScopeVisual() {
  const { ref, i } = useCycle(6, 1100);
  const picked = [[0], [0, 2], [0, 2, 4], [2, 4], [4], [1, 4]][i];
  return (
    <Stage stageRef={ref}>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const on = picked.includes(n);
          return (
            <motion.div
              key={n}
              animate={{ scale: on ? 1 : 0.94, opacity: on ? 1 : 0.45 }}
              transition={SPRING}
              className="relative grid h-14 place-items-center rounded-xl bg-gradient-to-br from-white/20 to-white/5"
            >
              <ImageIcon size={18} className="text-muted-foreground" />
              {on && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING} className="absolute right-1 top-1">
                  <CheckCircle size={16} weight="fill" />
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </Stage>
  );
}

export function BranchVisual() {
  const { ref, i } = useCycle(4, 1300);
  const yes = i % 2 === 0;
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-white/15"><ArrowsSplit size={16} /></span>
        <span>If they follow you...</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Pill on={i >= 1 && yes}>Send the link</Pill>
        <Pill on={i >= 1 && !yes}>Ask them to follow</Pill>
      </div>
      <motion.div key={`${yes}`} initial={{ opacity: 0 }} animate={{ opacity: i >= 1 ? 1 : 0 }} className="text-muted-foreground">
        {yes ? 'Yes: they get the link' : 'No: they get a follow request'}
      </motion.div>
    </Stage>
  );
}

export function ContactsTagsVisual() {
  const { ref, i } = useCycle(4, 1300);
  const tags = ['Lead', 'Buyer', 'VIP'];
  return (
    <Stage stageRef={ref}>
      {['Maya', 'Jordan', 'Sam'].map((name, r) => (
        <div key={name} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-1.5">
          <Avatar who={name} size={20} />
          {name}
          <span className="ml-auto flex gap-1">
            <Show when={i > r}>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                <Tag size={10} weight="fill" />
                {tags[r]}
              </span>
            </Show>
          </span>
        </div>
      ))}
    </Stage>
  );
}

export function SegmentsVisual() {
  const { ref, i } = useCycle(4, 1300);
  const widths = ['18%', '46%', '72%', '46%'];
  return (
    <Stage stageRef={ref}>
      <div className="flex flex-wrap gap-1.5">
        <Pill on={i >= 1}>Tag: Buyer</Pill>
        <Pill on={i >= 2}>City: Berlin</Pill>
        <Pill on={i === 3}>Follows you</Pill>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-accent" animate={{ width: widths[i] }} transition={{ duration: 0.8, ease: EASE }} />
      </div>
      <div className="text-muted-foreground">People in this group, updated as you filter</div>
    </Stage>
  );
}

export function TemplatesVisual() {
  const { ref, i } = useCycle(4, 1400);
  const items = ['Send my freebie', 'Price on request', 'Welcome new followers'];
  const sel = Math.min(i, 2);
  return (
    <Stage stageRef={ref}>
      {items.map((t, n) => (
        <motion.div
          key={t}
          animate={{ scale: sel === n && i < 3 ? 1.03 : 1, backgroundColor: sel === n && i < 3 ? 'rgba(250,250,250,0.18)' : 'rgba(250,250,250,0.07)' }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 rounded-xl px-3 py-2"
        >
          <Lightning size={14} weight="fill" /> {t}
          {i === 3 && n === 2 && <CheckCircle size={14} weight="fill" className="ml-auto text-success" />}
        </motion.div>
      ))}
    </Stage>
  );
}

export function ModerationVisual() {
  const { ref, i } = useCycle(5, 1300);
  const swiped = i >= 2;
  const gone = i >= 4;
  return (
    <Stage stageRef={ref}>
      <div className="rounded-xl bg-white/10 px-3 py-2">Great post, keep it up</div>
      <div className="relative overflow-hidden rounded-xl">
        <div className="absolute inset-y-0 right-0 grid w-20 place-items-center bg-danger/80 text-white">
          <motion.span animate={{ scale: swiped ? 1.2 : 0.8 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
            <EyeSlash size={18} weight="bold" />
          </motion.span>
        </div>
        <motion.div
          animate={{ x: swiped ? -80 : 0, opacity: gone ? 0 : 1, height: gone ? 0 : 'auto' }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="relative bg-[#1c1c1f] px-3 py-2"
        >
          buy followers cheap now
        </motion.div>
      </div>
      <Show when={gone}><span className="text-muted-foreground">Hidden automatically</span></Show>
    </Stage>
  );
}

export function ButtonsVisual() {
  const { ref, i } = useCycle(5, 1300);
  return (
    <Stage stageRef={ref}>
      <In>Want the guide? Follow us first.</In>
      <div className="flex gap-2">
        <motion.span animate={{ scale: i === 2 ? 0.94 : 1, backgroundColor: i >= 2 ? 'rgba(250,250,250,0.95)' : 'rgba(250,250,250,0.12)', color: i >= 2 ? '#0a0a0b' : '#fafafa' }} className="rounded-full px-3.5 py-1.5 font-semibold">
          I followed
        </motion.span>
        <span className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-muted-foreground">Not now</span>
      </div>
      <Show when={i >= 3}><Out>Thanks! Here is your guide.</Out></Show>
    </Stage>
  );
}

export function MergeTagVisual() {
  const { ref, i } = useCycle(4, 1400);
  const names = ['Maya', 'Jordan', 'Sam'];
  return (
    <Stage stageRef={ref}>
      <div className="text-muted-foreground">You write once</div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-2">
        Hi
        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">
          <UserCircle size={12} weight="fill" /> First name
        </span>
        , here is your link!
      </div>
      <div className="text-muted-foreground">Each person sees their own name</div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={i} initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <Out>Hi {names[i % 3]}, here is your link!</Out>
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}

export function TimedRepliesVisual() {
  const { ref, i } = useCycle(5, 1400);
  return (
    <Stage stageRef={ref}>
      <Show when={i >= 1}><Out>Thanks for commenting!</Out></Show>
      <Show when={i >= 2}>
        <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-muted-foreground">
          <Clock size={12} /> Wait 30 seconds
        </span>
      </Show>
      <Show when={i >= 4}><Out>Here is the link you wanted.</Out></Show>
    </Stage>
  );
}

/* ---------- coming soon ---------- */

export function SequenceVisual() {
  const { ref, i } = useCycle(5, 1300);
  const steps = ['Day 1: Welcome', 'Day 3: Your guide', 'Day 7: A little offer'];
  return (
    <Stage stageRef={ref}>
      <div className="relative flex flex-col gap-3 pl-1">
        <div className="absolute bottom-2 left-[9px] top-2 w-px bg-white/15" />
        <motion.div className="absolute left-[9px] top-2 w-px origin-top bg-accent" style={{ height: 'calc(100% - 1rem)' }} animate={{ scaleY: Math.min(i, 3) / 3 }} transition={{ duration: 0.9, ease: EASE }} />
        {steps.map((t, n) => (
          <div key={t} className="relative flex items-center gap-3">
            <motion.span
              animate={{ scale: i > n ? 1 : 0.8, backgroundColor: i > n ? 'rgba(250,250,250,1)' : 'rgba(40,40,44,1)' }}
              className="relative z-10 grid size-[18px] place-items-center rounded-full ring-1 ring-white/20"
            >
              {i > n && <CheckCircle size={12} weight="fill" className="text-background" />}
            </motion.span>
            <span className={i > n ? '' : 'text-muted-foreground'}>{t}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

export function BroadcastVisual() {
  const { ref, i } = useCycle(5, 1200);
  const toasts = ['Sent to Buyers', 'Sent to Leads', 'Sent to VIPs'];
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center gap-2"><PaperPlaneTilt size={16} weight="fill" /> One message, a whole group</div>
      <div className="relative mt-1 h-20">
        <AnimatePresence initial={false}>
          {toasts.slice(0, Math.max(0, i - 1)).map((t, n, arr) => {
            const depth = arr.length - 1 - n;
            return (
              <motion.div
                key={t}
                initial={{ opacity: 0, y: -24, scale: 0.9 }}
                animate={{ opacity: 1 - depth * 0.28, y: depth * 12, scale: 1 - depth * 0.05 }}
                exit={{ opacity: 0 }}
                transition={SPRING}
                className="absolute inset-x-0 top-0 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 shadow-lg"
                style={{ zIndex: n }}
              >
                <CheckCircle size={14} weight="fill" className="text-success" /> {t}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Stage>
  );
}

export function AnalyticsVisual() {
  const { ref, i } = useCycle(4, 2600);
  const pts = [46, 38, 44, 30, 34, 20, 24, 10];
  const d = pts.map((y, n) => `${n === 0 ? 'M' : 'L'} ${(n / (pts.length - 1)) * 260} ${y + 6}`).join(' ');
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center gap-2"><ChartBar size={16} /> DMs sent over time</div>
      <svg viewBox="0 0 260 64" className="h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fafafa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fafafa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path key={`a${i}`} d={`${d} L 260 64 L 0 64 Z`} fill="url(#spark-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }} />
        <motion.path key={`b${i}`} d={d} fill="none" stroke="#fafafa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: EASE }} />
        <motion.circle key={`c${i}`} cx="260" cy="16" r="3.5" fill="#fafafa" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3, type: 'spring' }} />
      </svg>
    </Stage>
  );
}

export function AiVisual() {
  const { ref, i } = useCycle(5, 1500);
  const reply = 'Yes we do! Shipping takes 5 to 7 days.';
  const [n, setN] = useState(0);
  const streaming = i >= 2;
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setN((c) => Math.min(c + 1, reply.length)), 32);
    return () => clearInterval(t);
  }, [streaming, reply.length]);
  const shown = streaming ? reply.slice(0, n) : '';
  return (
    <Stage stageRef={ref}>
      <In>Do you ship to Canada?</In>
      <Show when={i === 1}>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Robot size={14} />
          {[0, 1, 2].map((d) => (
            <motion.span key={d} className="size-1.5 rounded-full bg-current" animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
          ))}
        </span>
      </Show>
      {streaming && (
        <Out>
          {shown}
          <motion.span className="ml-px inline-block h-3 w-px translate-y-0.5 bg-current" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
        </Out>
      )}
    </Stage>
  );
}

export function InboxVisual() {
  const { ref, i } = useCycle(4, 1400);
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Conversation with Maya</span>
        <motion.span
          animate={i === 1 ? { rotate: [0, -18, 16, -12, 8, 0] } : { rotate: 0 }}
          transition={{ duration: 0.7 }}
          className="relative grid size-8 place-items-center rounded-full bg-white/10"
        >
          <Bell size={16} />
          {i >= 1 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING} className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-danger" />}
        </motion.span>
      </div>
      <In>Can I change my order?</In>
      <Show when={i >= 2}><div className="ml-auto rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-foreground">You: Of course, one moment!</div></Show>
      <Show when={i >= 3}><span className="mx-auto text-muted-foreground">Automation takes over again</span></Show>
    </Stage>
  );
}

export function RequestVisual() {
  const { ref, i } = useCycle(4, 1300);
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">Comment: PRICE</div>
      <motion.div animate={{ opacity: i >= 1 ? 1 : 0.3 }} className="ml-4 border-l border-white/20 pl-3 text-muted-foreground">
        Asks your own tool for today&apos;s price
      </motion.div>
      <Show when={i >= 2}><Out>Today&apos;s price is ready for you.</Out></Show>
    </Stage>
  );
}

export function GrowthVisual() {
  const { ref, i } = useCycle(4, 1300);
  return (
    <Stage stageRef={ref}>
      <div className="grid w-28 grid-cols-5 gap-1">
        {Array.from({ length: 25 }, (_, n) => (
          <motion.span key={n} animate={{ opacity: (n * 7 + i * 3) % 5 < 2 ? 1 : 0.15 }} transition={{ duration: 0.5 }} className="aspect-square rounded-[3px] bg-accent" />
        ))}
      </div>
      <div className="text-muted-foreground">Scan or tap a link to start a chat</div>
    </Stage>
  );
}

export function ApiVisual() {
  const { ref, i } = useCycle(4, 1300);
  return (
    <Stage stageRef={ref}>
      <div className="rounded-xl bg-white/10 px-3 py-2">Your own app or tool</div>
      <motion.div animate={{ scaleY: i >= 1 ? 1 : 0 }} style={{ originY: 0 }} className="ml-6 h-5 w-px bg-white/40" />
      <Show when={i >= 2}><div className="rounded-xl bg-accent px-3 py-2 text-accent-foreground">Convozy: send this DM</div></Show>
    </Stage>
  );
}

export function CommentDmVisual() {
  const { ref, i } = useCycle(4, 1400);
  return (
    <Stage stageRef={ref}>
      <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-white/10 px-3 py-2">
        <span className="font-semibold text-muted-foreground">@maya.creates</span> PRICE please!
      </div>
      <Show when={i >= 1}>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle size={12} weight="fill" className="text-success" /> Keyword found
        </span>
      </Show>
      <Show when={i >= 2}><Out>Here are the prices!</Out></Show>
    </Stage>
  );
}
