'use client';

import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

/** Deterministic and rounded so server and browser render identical markup. */
function seeded(i: number) {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return Math.round((v - Math.floor(v)) * 1e4) / 1e4;
}

const DUST = Array.from({ length: 26 }, (_, i) => ({
  left: `${Math.round(seeded(i) * 100)}%`,
  top: `${Math.round(seeded(i + 40) * 100)}%`,
  size: 1 + Math.round(seeded(i + 80) * 2),
  dx: `${Math.round((seeded(i + 120) - 0.5) * 80)}px`,
  duration: `${14 + Math.round(seeded(i + 160) * 16)}s`,
  delay: `-${Math.round(seeded(i + 200) * 20)}s`,
}));

/**
 * Fixed page backdrop for the marketing site: a faint grid, soft light orbs and
 * floating dust. Built to be stable on iPhone Safari:
 * - It is pinned to the large viewport height (100lvh), not inset-0. inset-0
 *   follows the dynamic viewport, so as the address bar slides in and out while
 *   scrolling, every blurred layer inside was resized and repainted, which
 *   showed up as the whole screen flickering in size.
 * - On touch devices (no hover, coarse pointer) it is static and lighter: no
 *   scroll-linked parallax, no animated blurred orbs, fewer dust specks, and no
 *   cursor glow. The animated, parallax version is for mouse devices only.
 */
export function MarketingBackdrop() {
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  const { scrollY } = useScroll();
  const gridY = useTransform(scrollY, [0, 1200], [0, -140]);
  const glowOpacity = useTransform(scrollY, [0, 700], [1, 0.4]);

  const px = useMotionValue(-400);
  const py = useMotionValue(-400);
  const sx = useSpring(px, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    const t = setTimeout(() => setFine(window.matchMedia('(hover: hover) and (pointer: fine)').matches), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (reduce || !fine) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX - 260);
      py.set(e.clientY - 260);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [reduce, fine, px, py]);

  const animate = fine && !reduce;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[100lvh] overflow-hidden [contain:strict]"
    >
      <motion.div
        style={animate ? { y: gridY } : undefined}
        className="marketing-backdrop absolute inset-x-0 top-0 h-[90lvh]"
      />

      <motion.div style={animate ? { opacity: glowOpacity } : undefined} className="absolute inset-0">
        <div className={`orb absolute left-1/2 top-[-12%] h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-white/[0.07] blur-[90px] md:blur-[120px] ${animate ? 'orb-a' : ''}`} />
        <div className={`orb absolute -left-24 top-[30%] size-96 rounded-full bg-white/[0.05] blur-[80px] md:blur-[110px] ${animate ? 'orb-b' : ''}`} />
        <div className={`orb absolute -right-24 top-[55%] size-[28rem] rounded-full bg-white/[0.05] blur-[80px] md:blur-[120px] ${animate ? 'orb-c' : ''}`} />
      </motion.div>

      {animate && (
        <motion.div
          style={{ x: sx, y: sy }}
          className="absolute left-0 top-0 size-[32rem] rounded-full bg-white/[0.045] blur-[90px]"
        />
      )}

      {DUST.slice(0, fine ? 26 : 8).map((d, i) => (
        <span
          key={i}
          className={`absolute rounded-full bg-white/70 ${animate ? 'dust' : 'opacity-30'}`}
          style={
            {
              left: d.left,
              top: d.top,
              width: d.size,
              height: d.size,
              '--dx': d.dx,
              animationDuration: d.duration,
              animationDelay: d.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
