'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  CaretLeft,
  ChatCircle,
  DotsThree,
  Heart,
  PaperPlaneTilt,
} from '@phosphor-icons/react';

const SCENES = [
  { comment: 'PRICE please!', dm: 'Hey! Here are the prices: convozy.orincore.com/example' },
  { comment: 'LINK? Yes please', dm: 'Here is your link: convozy.orincore.com/example' },
  { comment: 'GUIDE me, just starting', dm: 'Here is your free guide: convozy.orincore.com/example' },
];

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];
const SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const;
const GLASS =
  'bg-gradient-to-br from-white/[0.14] to-white/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.28),0_30px_80px_-30px_rgba(0,0,0,0.7)]';

/**
 * Story steps
 * 0 follower types a comment   1 comment posted   2 reply typing dots
 * 3 instant public reply       4 island notification
 * 5 DM screen, typing dots     6 DM received      7 delivered (hold)
 */
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

function Avatar({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/35 to-white/5 font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] ${
        dim ? 'size-5 text-[9px]' : 'size-7 text-[11px]'
      }`}
    >
      {label}
    </span>
  );
}

function Comment({
  name,
  time,
  avatar,
  small,
  children,
}: {
  name: string;
  time: string;
  avatar: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <Avatar label={avatar} dim={small} />
      <div className="min-w-0 flex-1 text-[11px] leading-snug">
        <p>
          <span className="font-semibold">{name}</span>{' '}
          <span className="text-muted-foreground">{time}</span>
        </p>
        <p className="mt-0.5 text-[12px]">{children}</p>
        <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Reply</p>
      </div>
      <Heart size={13} weight="light" className="mt-1 shrink-0 text-muted-foreground" />
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

/**
 * Hero visual: a generic phone plays the whole product story. A follower
 * types a keyword under a post, the comment lands, an instant reply appears
 * under it, a notification pops from the island, and the phone slides to the
 * DM that arrived. It loops through a few example keywords. Illustrative UI
 * with placeholder people, not a screenshot of Instagram.
 */
export function AutomationPreview() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [typed, setTyped] = useState(0);
  const [step, setStep] = useState<Step>(0);
  const active = SCENES[scene];

  const shown: Step = reduce ? 7 : step;
  const shownTyped = reduce ? active.comment.length : typed;
  const onInbox = shown >= 5;

  useEffect(() => {
    if (reduce) return;
    const lead = 1700;
    const ms = lead + active.comment.length * 60;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => setTyped((n) => Math.min(n + 1, active.comment.length)), 60);
    }, lead);
    const at = (t: number, s: Step) => setTimeout(() => setStep(s), ms + t);
    const timers = [
      at(400, 1),
      at(1300, 2),
      at(2400, 3),
      at(3900, 4),
      at(5600, 5),
      at(6900, 6),
      at(7900, 7),
      setTimeout(() => {
        setTyped(0);
        setStep(0);
        setScene((s) => (s + 1) % SCENES.length);
      }, ms + 12500),
    ];
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [scene, reduce, active.comment.length]);

  return (
    <div className="relative mx-auto w-full max-w-sm max-[359px]:-mb-12 max-[359px]:origin-top max-[359px]:scale-[0.88]">
      <motion.div
        aria-hidden="true"
        className="absolute -left-10 top-10 -z-10 size-56 rounded-full bg-white/20 blur-3xl"
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-8 bottom-16 -z-10 size-60 rounded-full bg-white/[0.14] blur-3xl"
        animate={reduce ? undefined : { x: [0, -36, 0], y: [0, -30, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className={`relative mx-auto h-[35rem] w-[18.75rem] rounded-[2.9rem] p-2 backdrop-blur-xl ${GLASS}`}>
        <div className="relative isolate h-full overflow-hidden rounded-[2.4rem] bg-black/60 [-webkit-mask-image:-webkit-radial-gradient(white,black)] [transform:translateZ(0)]">
          {/* island: springs open for the notification */}
          <motion.div
            className="absolute left-1/2 top-2.5 z-30 -translate-x-1/2 overflow-hidden rounded-[1.4rem] bg-black shadow-[0_10px_30px_-8px_rgba(0,0,0,0.9)]"
            initial={false}
            animate={
              shown === 4
                ? { width: 246, height: 56 }
                : { width: 84, height: 22 }
            }
            transition={{ type: 'spring', duration: 0.8, bounce: 0.22 }}
          >
            <AnimatePresence>
              {shown === 4 && (
                <motion.div
                  initial={{ opacity: 0, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="flex h-full items-center gap-2.5 px-3"
                >
                  <Avatar label="Y" />
                  <div className="min-w-0 text-left leading-tight">
                    <p className="text-[11px] font-semibold">your.handle</p>
                    <p className="truncate text-[10px] text-muted-foreground">Sent you a message</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {!onInbox ? (
              <motion.div
                key="post"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -48, filter: 'blur(8px)' }}
                transition={{ duration: 0.6, ease: EASE }}
                className="absolute inset-0 flex flex-col pt-11"
              >
                <div className="flex items-center gap-2 px-4 pb-2.5">
                  <Avatar label="Y" />
                  <span className="text-xs font-semibold">your.handle</span>
                  <DotsThree size={18} className="ml-auto text-muted-foreground" />
                </div>
                <div className="relative h-44 w-full shrink-0">
                  <Image
                    src="https://picsum.photos/seed/creator-desk/640/420"
                    alt="A creator's photo post"
                    fill
                    sizes="300px"
                    unoptimized
                    className="object-cover grayscale"
                  />
                </div>
                <div className="flex items-center gap-3 px-4 pt-2.5 text-muted-foreground">
                  <Heart size={19} weight="light" />
                  <ChatCircle size={19} weight="light" />
                  <PaperPlaneTilt size={19} weight="light" />
                </div>

                {/* comments sheet, like the real thing: grabber, title, list, input */}
                <motion.div
                  initial={reduce ? false : { y: '100%' }}
                  animate={{ y: 0 }}
                  transition={{ type: 'spring', duration: 0.9, bounce: 0.12, delay: reduce ? 0 : 0.9 }}
                  className="absolute inset-x-0 bottom-0 flex h-[72%] flex-col rounded-t-[1.6rem] bg-[#141416] shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)]"
                >
                  <div className="flex flex-col items-center gap-2 pb-2.5 pt-2">
                    <span className="h-1 w-9 rounded-full bg-white/25" />
                    <span className="text-xs font-semibold">Comments</span>
                  </div>

                  <div className="relative min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_14px)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_14px)]">
                  <motion.div
                    className="flex flex-col gap-3.5 px-3.5 pt-1 pb-3"
                    animate={{ y: shown >= 2 ? -58 : 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  >
                    <Comment name="your.handle" time="1d" avatar="Y">
                      Comment {active.comment.split(/[ ?!,]/)[0]} and I&apos;ll send it over
                    </Comment>
                    <Comment name="jordan.k" time="5h" avatar="J">
                      Love this so much
                    </Comment>

                    <AnimatePresence>
                      {shown >= 1 && (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 14, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={SPRING}
                        >
                          <Comment name="a.follower" time="Just now" avatar="A">
                            {active.comment}
                          </Comment>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {shown >= 2 && (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={SPRING}
                          className="ml-9"
                        >
                          <Comment name="your.handle" time="Just now" avatar="Y" small>
                            <AnimatePresence mode="wait" initial={false}>
                              {shown === 2 ? (
                                <motion.span
                                  key="dots"
                                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                  className="text-muted-foreground"
                                >
                                  <Dots />
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="reply"
                                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                                  transition={{ duration: 0.4 }}
                                >
                                  <span className="text-[#a1a1aa]">@a.follower</span> Sent you a DM, check
                                  your inbox!
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Comment>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 pb-3 pt-2.5">
                    <Avatar label="A" />
                    <div className="flex h-9 min-w-0 flex-1 items-center rounded-full bg-white/[0.07] px-3.5 text-[11px]">
                      {shown === 0 && shownTyped > 0 ? (
                        <span className="truncate">
                          {active.comment.slice(0, shownTyped)}
                          {!reduce && (
                            <span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-foreground" />
                          )}
                        </span>
                      ) : (
                        <span className="truncate text-muted-foreground">Add a comment for your.handle...</span>
                      )}
                    </div>
                    <motion.span
                      animate={{
                        scale: shown === 0 && shownTyped === active.comment.length ? [1, 1.25, 1] : 1,
                        opacity: shown === 0 && shownTyped > 0 ? 1 : 0.35,
                      }}
                      transition={{ duration: 0.35 }}
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
                    >
                      <ArrowUp size={15} weight="bold" />
                    </motion.span>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="inbox"
                initial={{ opacity: 0, x: 48, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="absolute inset-0 flex flex-col pt-11"
              >
                <div className="flex items-center gap-2 px-3 pb-3">
                  <CaretLeft size={18} className="text-muted-foreground" />
                  <Avatar label="Y" />
                  <span className="text-xs font-semibold">your.handle</span>
                </div>

                <div className="flex flex-1 flex-col justify-end gap-2 px-4 pb-8">
                  <p className="text-center text-[10px] text-muted-foreground">Just now</p>
                  <div className="flex items-end gap-2">
                    <Avatar label="Y" dim />
                    <AnimatePresence mode="wait" initial={false}>
                      {shown === 5 ? (
                        <motion.div
                          key="typing"
                          initial={{ opacity: 0, scale: 0.9, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                          transition={SPRING}
                          className="rounded-2xl rounded-bl-md bg-white/[0.1] px-3.5 py-2 text-muted-foreground"
                        >
                          <Dots />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="msg"
                          initial={{ opacity: 0, scale: 0.92, y: 10, filter: 'blur(6px)' }}
                          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                          transition={SPRING}
                          className="relative max-w-[82%] overflow-hidden rounded-2xl rounded-bl-md bg-gradient-to-br from-white to-white/80 px-3.5 py-2.5 text-[11px] leading-snug text-accent-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_18px_50px_-12px_rgba(250,250,250,0.4)]"
                        >
                          {!reduce && (
                            <motion.span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                              animate={{ x: ['0%', '400%'] }}
                              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                            />
                          )}
                          {active.dm}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.p
                    initial={false}
                    animate={{ opacity: shown >= 7 ? 1 : 0 }}
                    className="pl-7 text-[10px] text-muted-foreground"
                  >
                    Delivered
                  </motion.p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
