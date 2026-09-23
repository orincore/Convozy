'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, Minus } from '@phosphor-icons/react';
import { CtaButton } from './cta-button';
import { DonateButton } from './donate-button';
import { SpotlightCard } from './spotlight-card';

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];
const SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const;

/* ---------- plan cards ---------- */

interface Feature {
  label: string;
  soon?: boolean;
  joke?: string;
}

const FREE: Feature[] = [
  { label: 'Comment to DM, Story replies and live comments' },
  { label: 'Pick which posts each automation runs on' },
  { label: 'Contacts, tags, groups and ready-made templates' },
  { label: 'If this, then that replies, buttons and timed messages' },
  { label: 'Hide unwanted comments automatically' },
  { label: 'One connected Instagram account' },
];

const PRO: Feature[] = [
  { label: 'More DMs than your ex ever sent you' },
  { label: 'More than one Instagram account, and nobody gets jealous' },
  { label: 'Priority support: we text back, unlike some people' },
  { label: 'AI replies: always says the right thing, unlike you at 2am', soon: true, joke: 'Coming soon, listens better than your ex' },
];

function FeatureList({ items }: { items: Feature[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {items.map((f, i) => (
        <motion.li
          key={f.label}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.6, delay: 0.1 + i * 0.07, ease: EASE }}
          className="flex items-start gap-3 text-sm"
        >
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <Check size={12} weight="bold" />
          </span>
          <span>
            {f.label}
            {f.soon && (
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                {f.joke ?? 'Coming soon'}
              </span>
            )}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

export function PlanCards() {
  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-5">
      <motion.div
        className="lg:col-span-3"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <div className="h-full rounded-[2rem] border border-white/20 bg-white/[0.05] p-1.5">
          <SpotlightCard className="flex h-full flex-col rounded-[calc(2rem-0.375rem)] bg-card p-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] sm:p-9">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-white/[0.12] blur-3xl" aria-hidden="true" />
            <h2 className="relative text-sm font-semibold text-muted-foreground">Free</h2>
            <div className="relative mt-3 flex items-baseline gap-3">
              <span className="font-display text-7xl font-semibold tracking-tight">$0</span>
              <span className="text-muted-foreground">forever, no card</span>
            </div>
            <p className="relative mt-3 max-w-md text-muted-foreground">
              Every feature that works today, on your real account. Not a trial.
            </p>
            <div className="relative flex-1">
              <FeatureList items={FREE} />
            </div>
            <div className="relative mt-9">
              <CtaButton href="/app/login">Start free</CtaButton>
            </div>
          </SpotlightCard>
        </div>
      </motion.div>

      <motion.div
        className="lg:col-span-2"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
      >
        <div className="h-full rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
          <SpotlightCard className="flex h-full flex-col rounded-[calc(2rem-0.375rem)] bg-card p-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] sm:p-9">
            <h2 className="text-sm font-semibold text-muted-foreground">Pro</h2>
            <div className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              A healthy relationship with your DMs
            </div>
            <p className="mt-3 text-muted-foreground">
              Unlike your ex, it replies instantly, never leaves anyone on read, and has never once said &ldquo;we
              need to talk&rdquo;.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">Everything in Free, plus:</p>
            <div className="flex-1">
              <FeatureList items={PRO} />
            </div>
            <div className="mt-9">
              <DonateButton />
            </div>
          </SpotlightCard>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- comparison ---------- */

type Cell = boolean | string;
interface Row {
  label: string;
  free: Cell;
  pro: Cell;
}
interface Group {
  title: string;
  rows: Row[];
}

const GROUPS: Group[] = [
  {
    title: 'Replies',
    rows: [
      { label: 'Comment to DM', free: true, pro: true },
      { label: 'Story replies', free: true, pro: true },
      { label: 'Live comments', free: true, pro: true },
      { label: 'Pick which posts it runs on', free: true, pro: true },
      { label: 'Hide unwanted comments', free: true, pro: true },
    ],
  },
  {
    title: 'People and messages',
    rows: [
      { label: 'Contacts, tags and groups', free: true, pro: true },
      { label: 'Ready-made templates', free: true, pro: true },
      { label: 'If this, then that replies', free: true, pro: true },
      { label: 'Buttons and follow first', free: true, pro: true },
      { label: 'Personal messages with names', free: true, pro: true },
      { label: 'Timed replies', free: true, pro: true },
    ],
  },
  {
    title: 'Limits and support',
    rows: [
      { label: 'Instagram accounts', free: 'One', pro: 'More than one. Nobody gets jealous.' },
      { label: 'DMs each month', free: 'Monthly limit', pro: 'Higher limit. Go ahead, get popular.' },
      { label: 'Support', free: 'Email', pro: 'Priority. We actually text back.' },
      { label: 'AI replies', free: false, pro: 'Coming soon, listens better than your ex' },
    ],
  },
];

function Value({ v }: { v: Cell }) {
  if (v === true) {
    return (
      <motion.span
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={SPRING}
        className="mx-auto grid size-6 place-items-center rounded-full bg-accent text-accent-foreground"
      >
        <Check size={13} weight="bold" />
        <span className="sr-only">Included</span>
      </motion.span>
    );
  }
  if (v === false) {
    return (
      <span className="mx-auto grid size-6 place-items-center text-muted-foreground">
        <Minus size={14} />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span>{v}</span>;
}

export function Comparison() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
      <div className="overflow-hidden rounded-[calc(2rem-0.375rem)] bg-card p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] sm:p-8">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Free and Pro compared</caption>
          <thead>
            <tr>
              <th scope="col" className="w-1/2 pb-5" />
              <th scope="col" className="pb-5 text-center font-display text-base font-semibold">Free</th>
              <th scope="col" className="pb-5 text-center font-display text-base font-semibold">Pro</th>
            </tr>
          </thead>
          {GROUPS.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th scope="colgroup" colSpan={3} className="pb-3 pt-8 text-left text-sm font-medium text-muted-foreground">
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label} className="[&>*]:border-b [&>*]:border-dashed [&>*]:border-white/10 hover:bg-white/[0.03]">
                  <th scope="row" className="py-3.5 pr-3 text-left font-normal">{r.label}</th>
                  <td className="py-3.5 text-center text-muted-foreground"><Value v={r.free} /></td>
                  <td className="py-3.5 pl-2 text-center text-muted-foreground"><Value v={r.pro} /></td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        {sub && <p className="mt-3 max-w-xl text-lg text-muted-foreground">{sub}</p>}
      </motion.div>
      <div className="mt-10">{children}</div>
    </section>
  );
}
