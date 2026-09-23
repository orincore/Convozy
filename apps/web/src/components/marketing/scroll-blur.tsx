'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from 'motion/react';

/**
 * Real motion blur while scrolling: the picture smears vertically (along the
 * direction of travel) by an amount that follows scroll speed, and stays sharp
 * sideways, then clears when scrolling stops. A fixed click-through layer
 * applies an SVG filter with a vertical-only Gaussian blur as its backdrop, so
 * page content is never touched. It sits just below the navbar (z-39 vs z-40 inside the
 * same stacking context), so the navbar stays perfectly sharp. Runs on motion values (no
 * React re-render per frame). Only enabled in Chromium-based browsers, the ones
 * that support SVG filters in backdrop-filter; skipped elsewhere (Safari and
 * iOS, Firefox) and for reduced motion, where it would otherwise fall back to
 * a flat all-directions blur.
 */
const MAX_BLUR = 7;

export function ScrollBlur() {
  const reduce = useReducedMotion();
  const [supported, setSupported] = useState(false);
  const blurNode = useRef<SVGFEGaussianBlurElement>(null);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { stiffness: 220, damping: 32 });
  const amount = useTransform(smooth, (v) => Math.min(MAX_BLUR, Math.max(0, (Math.abs(v) - 350) / 500)));
  const filter = useTransform(amount, (a) => (a < 0.25 ? 'none' : 'url(#scroll-motion-blur)'));

  useEffect(() => {
    const ua = navigator.userAgent;
    const chromium = /Chrome\//.test(ua) && !/iPhone|iPad|iPod|Firefox/.test(ua);
    const t = setTimeout(() => setSupported(chromium), 0);
    return () => clearTimeout(t);
  }, []);

  useMotionValueEvent(amount, 'change', (a) => {
    blurNode.current?.setAttribute('stdDeviation', `0 ${a.toFixed(2)}`);
  });

  if (reduce || !supported) return null;

  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="scroll-motion-blur" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur ref={blurNode} stdDeviation="0 0" />
        </filter>
      </svg>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[39]"
        style={{ backdropFilter: filter, WebkitBackdropFilter: filter }}
      />
    </>
  );
}
