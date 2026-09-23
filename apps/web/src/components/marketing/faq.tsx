'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from '@phosphor-icons/react';

/** Animated accordion: one answer open at a time, height and fade spring open. */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.question}>
            <h3>
              <button
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-base font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {item.question}
                <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  <Plus size={18} weight="bold" className="shrink-0 text-muted-foreground" />
                </motion.span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-5 text-muted-foreground">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
