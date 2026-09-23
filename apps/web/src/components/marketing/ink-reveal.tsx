'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Headline words that resolve out of liquid noise on load, then settle into
 * crisp type. Adapted from Spectrum UI's Fluid Ink Morph (spectrumhq.in):
 * ported to our tokens (monochrome), and the SVG filter is removed once the
 * animation ends so the text is rendered normally afterwards.
 */
export function InkReveal({
  children,
  settleMs = 4200,
  repeatAfterMs = 7000,
}: {
  children: ReactNode;
  settleMs?: number;
  repeatAfterMs?: number;
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, '_');
  const turb = useRef<SVGFETurbulenceElement>(null);
  const disp = useRef<SVGFEDisplacementMapElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done || reduce) return;
    const t = setTimeout(() => setDone(false), repeatAfterMs);
    return () => clearTimeout(t);
  }, [done, reduce, repeatAfterMs]);

  useEffect(() => {
    if (reduce || done) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / settleMs);
      const ease = p * p * (3 - 2 * p);
      const freq = 0.28 + (0.002 - 0.28) * ease;
      turb.current?.setAttribute('baseFrequency', `${freq} ${freq * 0.9}`);
      disp.current?.setAttribute('scale', `${60 * (1 - ease)}`);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, done, settleMs]);

  if (reduce || done) return <span className="text-shimmer">{children}</span>;

  return (
    <span className="text-shimmer relative inline-block" style={{ filter: `url(#ink_${id})` }}>
      {children}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id={`ink_${id}`}>
          <feTurbulence
            ref={turb}
            type="fractalNoise"
            baseFrequency="0.28 0.25"
            numOctaves="2"
            stitchTiles="stitch"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            ref={disp}
            in="SourceGraphic"
            in2="noise"
            scale="60"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
    </span>
  );
}
