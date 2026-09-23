'use client';

import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';
import type { PointerEvent } from 'react';

/**
 * Oversized wordmark that lights up under the pointer. Adapted from Spectrum
 * UI's Wordmark Spotlight Footer (spectrumhq.in); pointer position lives in
 * motion values so moving the mouse never re-renders React.
 */
export function WordmarkGlow({ word }: { word: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-999);
  const y = useMotionValue(-999);
  const mask = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, #000 0%, rgba(0,0,0,0.45) 45%, transparent 72%)`;

  function move(e: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    x.set(e.clientX - box.left);
    y.set(e.clientY - box.top);
  }

  const size = `clamp(48px, ${(120 / word.length).toFixed(1)}cqi, 220px)`;

  return (
    <div
      ref={ref}
      onPointerMove={reduce ? undefined : move}
      onPointerLeave={() => {
        x.set(-999);
        y.set(-999);
      }}
      className="relative select-none overflow-hidden"
      style={{ containerType: 'inline-size' }}
      aria-hidden="true"
    >
      <p
        className="font-display whitespace-nowrap font-semibold leading-[0.85] tracking-[-0.05em] text-foreground/[0.06]"
        style={{ fontSize: size }}
      >
        {word}
      </p>
      {!reduce && (
        <motion.p
          className="font-display pointer-events-none absolute inset-0 whitespace-nowrap font-semibold leading-[0.85] tracking-[-0.05em] text-foreground"
          style={{ fontSize: size, WebkitMaskImage: mask, maskImage: mask }}
        >
          {word}
        </motion.p>
      )}
    </div>
  );
}
