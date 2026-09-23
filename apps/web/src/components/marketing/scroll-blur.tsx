'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from 'motion/react';

/**
 * Motion blur while scrolling: a fixed, click-through layer that blurs whatever
 * is behind it in proportion to how fast the page is moving, and clears as
 * soon as scrolling settles. It only touches a fixed overlay (never the page
 * content), so fixed elements and layout are unaffected, and everything runs
 * on motion values, so scrolling never re-renders React. Capped low so text
 * stays readable; skipped for reduced motion.
 */
const MAX_BLUR = 4;

export function ScrollBlur() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { stiffness: 160, damping: 30 });
  const blur = useTransform(smooth, (v) => Math.min(MAX_BLUR, Math.max(0, (Math.abs(v) - 400) / 900)));
  const filter = useTransform(blur, (b) => (b < 0.15 ? 'none' : `blur(${b.toFixed(2)}px)`));

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[45]"
      style={{ backdropFilter: filter, WebkitBackdropFilter: filter }}
    />
  );
}
