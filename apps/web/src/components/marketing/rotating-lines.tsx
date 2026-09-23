'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface RotatingLine {
  text: string;
  highlight?: string[];
}

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
  exit: { transition: { staggerChildren: 0.012, staggerDirection: -1 } },
};

const word = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE } },
  exit: { opacity: 0, y: -8, filter: 'blur(6px)', transition: { duration: 0.3, ease: EASE } },
};

/**
 * Cycles through short lines: each one blurs in word by word, holds, then
 * blurs out before the next. Only opacity, transform and a small blur are
 * animated. The box keeps a fixed height so nothing below it jumps.
 */
export function RotatingLines({
  lines,
  intervalMs = 5500,
  className,
}: {
  lines: RotatingLine[];
  intervalMs?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || lines.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % lines.length), intervalMs);
    return () => clearInterval(t);
  }, [reduce, lines.length, intervalMs]);

  const line = lines[reduce ? 0 : index];
  const marks = new Set(line.highlight ?? []);

  return (
    <div className={className} aria-live="off">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={index}
          variants={container}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {line.text.split(' ').map((w, i, all) => (
            <motion.span
              key={`${w}-${i}`}
              variants={word}
              className={`inline-block ${marks.has(w.replace(/[.,!?']+$/, '')) ? 'font-medium text-foreground' : ''}`}
            >
              {w}
              {i < all.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
