'use client';

import { motion } from 'motion/react';
import { ArrowUpRight, ChatsCircle, Lightning, PlugsConnected, ShieldCheck } from '@phosphor-icons/react';

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

const FACTS = [
  { Icon: ShieldCheck, title: 'No card needed', body: 'Start free and never enter payment details.' },
  { Icon: Lightning, title: 'Live in minutes', body: 'Connect, pick a keyword, switch it on.' },
  { Icon: PlugsConnected, title: 'Leave any time', body: 'Disconnect Instagram whenever you like.' },
];

/**
 * Left column beside the FAQ: heading, a few quick facts and an email card. It
 * stays in view while the tall FAQ card scrolls, so there is no empty column.
 */
export function FaqAside({ title, sub, email }: { title: string; sub: string; email: string }) {
  return (
    <div className="lg:sticky lg:top-28">
      <h2 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h2>
      <p className="mt-4 max-w-sm text-lg text-muted-foreground">{sub}</p>

      <ul className="mt-10 flex max-w-sm flex-col gap-3">
        {FACTS.map((f, i) => (
          <motion.li
            key={f.title}
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.7, delay: 0.1 + i * 0.1, ease: EASE }}
            className="flex items-center gap-4 rounded-2xl bg-white/[0.05] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
              <f.Icon size={20} weight="bold" />
            </span>
            <span className="text-sm">
              <span className="block font-medium">{f.title}</span>
              <span className="text-muted-foreground">{f.body}</span>
            </span>
          </motion.li>
        ))}
      </ul>

      <motion.a
        href={`mailto:${email}`}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
        className="group mt-4 flex max-w-sm items-center gap-4 rounded-2xl bg-accent p-4 text-accent-foreground transition-transform duration-300 active:scale-[0.98]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-foreground/10">
          <ChatsCircle size={20} weight="fill" />
        </span>
        <span className="text-sm">
          <span className="block font-semibold">Ask us anything</span>
          <span className="opacity-70">{email}</span>
        </span>
        <ArrowUpRight size={18} weight="bold" className="ml-auto transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </motion.a>
    </div>
  );
}
