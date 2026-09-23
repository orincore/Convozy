'use client';

import { useRef, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Interactive card: cursor spotlight, a slowly orbiting border highlight and
 * an optional 3D tilt, all on hover only (no always-on loops). Adapted from
 * Spectrum UI's Bento Card (spectrumhq.in): ported from framer-motion to
 * motion/react, from light/dark neutrals to our locked monochrome tokens,
 * and the border animation gated to hover so idle cards cost nothing.
 * Pointer input uses motion values, never React state.
 */
export function SpotlightCard({
  children,
  className,
  tilt = false,
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tiltX = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });
  const rotateX = useTransform(tiltY, [-150, 150], [4, -4]);
  const rotateY = useTransform(tiltX, [-150, 150], [-4, 4]);
  const spotlight = useMotionTemplate`radial-gradient(320px circle at ${x}px ${y}px, rgba(250,250,250,0.09), transparent 75%)`;

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
    if (tilt) {
      tiltX.set(event.clientX - rect.left - rect.width / 2);
      tiltY.set(event.clientY - rect.top - rect.height / 2);
    }
  }

  function handleLeave() {
    setHovered(false);
    tiltX.set(0);
    tiltY.set(0);
  }

  if (reduce) {
    return (
      <div className={cn('relative isolate overflow-hidden', className)}>{children}</div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={tilt ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
      className={cn('group relative isolate overflow-hidden', className)}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px z-10 rounded-[inherit] transition-opacity duration-300"
        style={{ background: spotlight, opacity: hovered ? 1 : 0 }}
      />
      {hovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] p-px [mask-composite:exclude] [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)]"
        >
          <motion.div
            className="absolute left-1/2 top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(250,250,250,0) 0%, rgba(250,250,250,0.55) 50%, rgba(250,250,250,0) 100%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 6 }}
          />
        </div>
      )}
      {children}
    </motion.div>
  );
}
