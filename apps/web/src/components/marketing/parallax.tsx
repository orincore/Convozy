'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { ReactNode } from 'react';

/** Drifts its children vertically as the section scrolls past, for depth. */
export function Parallax({ children, from = 40, to = -40 }: { children: ReactNode; from?: number; to?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);
  return (
    <motion.div ref={ref} style={{ y: reduce ? 0 : y }}>
      {children}
    </motion.div>
  );
}
