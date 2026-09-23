'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EnvelopeSimple, Plus } from '@phosphor-icons/react';

export interface FaqTab {
  label: string;
  faqs: { question: string; answer: string }[];
  /** When set, the tab shows this single message instead of the question list. */
  note?: { title: string; text: string; action?: React.ReactNode };
}

const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;
const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

/**
 * Tabbed FAQ card: a sliding pill switches topic, one answer is open at a time
 * and springs open, and a footer points to email support. Layout and tab
 * behaviour follow Spectrum UI's FAQ Tabs Card (spectrumhq.in), restyled to
 * our tokens and double-bezel container.
 */
export function Faq({ tabs, supportEmail }: { tabs: FaqTab[]; supportEmail: string }) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const current = tabs[tab];

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
      <div className="rounded-[calc(2rem-0.375rem)] bg-card p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] sm:p-6">
        <div className="relative flex gap-1 rounded-full bg-white/[0.06] p-1" role="tablist" aria-label="Question topics">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === tab}
              onClick={() => {
                setTab(i);
                setOpen(0);
              }}
              className="relative flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {i === tab && (
                <motion.span layoutId="faq-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-accent" />
              )}
              <span className={`relative ${i === tab ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={tab}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mt-4 flex min-h-[22rem] flex-col gap-2"
          >
            {current.note && (
              <li className="flex min-h-[24.75rem] flex-col justify-center rounded-2xl bg-white/[0.06] p-6 sm:p-8">
                <h3 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{current.note.title}</h3>
                <p className="mt-3 text-lg text-muted-foreground">{current.note.text}</p>
                {current.note.action && <div className="mt-6">{current.note.action}</div>}
              </li>
            )}
            {current.faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <li
                  key={f.question}
                  className={`rounded-2xl transition-colors duration-300 ${isOpen ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
                >
                  <h3>
                    <button
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-6 rounded-2xl px-4 py-4 text-left text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      {f.question}
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={SPRING}
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10"
                      >
                        <Plus size={14} weight="bold" />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 pr-14 text-muted-foreground">{f.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </motion.ul>
        </AnimatePresence>

        <a
          href={`mailto:${supportEmail}`}
          className="group mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 text-sm transition-colors hover:bg-white/[0.09]"
        >
          <span className="flex items-center gap-2.5">
            <EnvelopeSimple size={18} />
            Still have a question? Email us
          </span>
          <span className="text-muted-foreground transition-transform duration-300 group-hover:translate-x-1">{supportEmail}</span>
        </a>
      </div>
    </div>
  );
}
