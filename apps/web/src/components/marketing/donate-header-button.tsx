'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Heart } from '@phosphor-icons/react';
import { DONATE_PAGE } from '@/lib/donate';

/**
 * Header donate button: a glass pill with a beating heart in an inverted badge.
 * The heart does a double beat every few seconds and sends out a soft ring; on
 * hover the heart turns red and little hearts float up (heart pop and burst
 * after Spectrum UI's Like Button). The label hides on very small screens.
 */
export function DonateHeaderButton() {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={DONATE_PAGE}
      aria-label="Donate to Convozy"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="group relative inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] py-1 pl-1 pr-3.5 text-sm font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.12] active:scale-[0.97] max-sm:pr-1"
    >
      <span className="relative grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white/50"
            animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeOut' }}
          />
        )}
        <motion.span
          className="relative"
          animate={reduce ? undefined : { scale: [1, 1.22, 1, 1.16, 1] }}
          transition={{ duration: 0.9, times: [0, 0.18, 0.36, 0.54, 1], repeat: Infinity, repeatDelay: 1.9, ease: 'easeInOut' }}
        >
          <Heart size={14} weight="fill" className={`transition-colors duration-300 ${hover ? 'text-danger' : ''}`} />
        </motion.span>

        <AnimatePresence>
          {hover &&
            !reduce &&
            [-1, 0, 1].map((n) => (
              <motion.span
                key={n}
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 text-danger"
                initial={{ opacity: 0.9, x: n * 6 - 4, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, x: n * 12 - 4, y: -22, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, delay: (n + 1) * 0.08, ease: 'easeOut' }}
              >
                <Heart size={9} weight="fill" />
              </motion.span>
            ))}
        </AnimatePresence>
      </span>
      <span className="hidden sm:inline">Donate</span>
    </Link>
  );
}
