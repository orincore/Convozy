'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Centered partner statement. Wording is "Official Meta Business Partner" at the
 * owner's explicit instruction (2026-09-24); the owner states Convozy is an
 * approved Meta Tech Provider and live with users. Meta treats Tech Provider and
 * Business Partner as separate designations, so keep this in step with what the
 * Meta dashboard actually shows. Change the text here if that differs.
 * Real brand marks via Simple Icons. Motion is a simple blur-fade on scroll.
 */
const MARKS = ['meta', 'instagram'];
const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

export function IntegrationBadges() {
  const reduce = useReducedMotion();
  const item = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24, filter: 'blur(10px)' },
    whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, amount: 0.5 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <motion.div {...item(0)} className="flex items-center gap-6 sm:gap-8">
        {MARKS.map((slug) => (
          <Image
            key={slug}
            src={`https://cdn.simpleicons.org/${slug}/fafafa`}
            alt={slug === 'meta' ? 'Meta' : 'Instagram'}
            width={48}
            height={48}
            unoptimized
            className="size-8 sm:size-10"
          />
        ))}
      </motion.div>
      <motion.h2
        {...item(0.12)}
        className="font-display max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        Official Meta Business Partner
      </motion.h2>
      <motion.p
        {...item(0.24)}
        className="mt-1 max-w-lg text-sm font-medium text-foreground sm:text-base"
      >
        We reply faster than{' '}
        <span className="rounded-md bg-white/15 px-1.5 py-0.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
          your ex
        </span>{' '}
        does.
      </motion.p>
    </div>
  );
}
