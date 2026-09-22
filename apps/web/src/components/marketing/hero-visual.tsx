'use client';

import { motion, useReducedMotion } from 'motion/react';
import { ChatCircleText, PaperPlaneTilt, Sparkle } from '@phosphor-icons/react';

/**
 * Illustrative "comment becomes a DM" flow card - not a literal Instagram
 * screenshot (avoids impersonating Instagram's actual UI/trademark), just an
 * abstracted visual of the product's core mechanic. Motion is motivated:
 * it demonstrates the automation happening, matching what the product does.
 */
export function HeroVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/10 blur-2xl" aria-hidden="true" />

      <div className="rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ChatCircleText size={16} weight="bold" />
          New comment
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-3 rounded-xl bg-muted px-3.5 py-3 text-sm text-foreground"
        >
          <span className="font-medium">@marcus.creates</span>{' '}
          <span className="font-semibold underline decoration-2 underline-offset-2">PRICE</span>{' '}
          send it over 🙌
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          style={{ transformOrigin: 'top' }}
          className="ml-5 h-6 w-px bg-border"
          aria-hidden="true"
        />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.85 }}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
        >
          <PaperPlaneTilt size={16} weight="bold" />
          Sent automatically
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-3 flex items-start gap-2 rounded-xl bg-accent px-3.5 py-3 text-sm text-accent-foreground"
        >
          <Sparkle size={16} weight="fill" className="mt-0.5 shrink-0" />
          Here&apos;s the link, thanks for asking! convozy.orincore.com/p/xyz
        </motion.div>
      </div>
    </div>
  );
}
