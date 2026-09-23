'use client';

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';

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
 * Fixed, non-interactive page backdrop, rendered once for the whole marketing
 * site: a grid that drifts with scroll, slow-moving light orbs, floating dust,
 * and a soft glow that trails the cursor. Everything animates transform or
 * opacity only, and it all stops under prefers-reduced-motion.
 */
export function MarketingBackdrop() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const gridY = useTransform(scrollY, [0, 1200], [0, -140]);
  const glowOpacity = useTransform(scrollY, [0, 700], [1, 0.4]);

  const px = useMotionValue(-400);
  const py = useMotionValue(-400);
  const sx = useSpring(px, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX - 260);
      py.set(e.clientY - 260);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [reduce, px, py]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div style={{ y: reduce ? 0 : gridY }} className="marketing-backdrop absolute inset-x-0 top-0 h-[90vh]" />

      <motion.div style={{ opacity: glowOpacity }} className="absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-[-12%] h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-white/[0.07] blur-[120px]"
          animate={reduce ? undefined : { scale: [1, 1.1, 1], x: ['-50%', '-46%', '-50%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -left-24 top-[30%] size-96 rounded-full bg-white/[0.05] blur-[110px]"
          animate={reduce ? undefined : { x: [0, 120, 0], y: [0, 80, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-24 top-[55%] size-[28rem] rounded-full bg-white/[0.05] blur-[120px]"
          animate={reduce ? undefined : { x: [0, -140, 0], y: [0, -90, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {!reduce && (
        <motion.div
          style={{ x: sx, y: sy }}
          className="absolute left-0 top-0 hidden size-[32rem] rounded-full bg-white/[0.045] blur-[90px] md:block"
        />
      )}

      {!reduce &&
        DUST.map((d, i) => (
          <span
            key={i}
            className="dust absolute rounded-full bg-white/70"
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
