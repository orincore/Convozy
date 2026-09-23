'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const STEPS = 14;

/**
 * Headline words that resolve out of liquid ink noise, settle into crisp
 * type, then play again after a pause. Adapted from Spectrum UI's Fluid Ink
 * Morph (spectrumhq.in).
 *
 * Smoothness: the expensive part of an SVG noise filter is regenerating the
 * noise. The distortion strength updates every frame, but the noise itself
 * only changes in a handful of steps, the filter runs in sRGB (skips a color
 * space conversion) with one octave, and the filter is removed entirely once
 * the text has settled.
 */
export function InkReveal({
  text,
  settleMs = 4200,
  repeatAfterMs = 7000,
}: {
  text: string;
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
    let lastStep = -1;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / settleMs);
      const ease = p * p * (3 - 2 * p);
      const step = Math.floor(ease * STEPS);
      if (step !== lastStep) {
        lastStep = step;
        const freq = 0.28 + (0.002 - 0.28) * (step / STEPS);
        turb.current?.setAttribute('baseFrequency', `${freq.toFixed(4)} ${(freq * 0.9).toFixed(4)}`);
      }
      disp.current?.setAttribute('scale', (60 * (1 - ease)).toFixed(1));
      if (p < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, done, settleMs]);

  if (reduce) return <span>{text}</span>;
  if (done) return <span className="text-shimmer">{text}</span>;

  return (
    <span className="relative inline-block" style={{ filter: `url(#ink_${id})` }}>
      {text}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id={`ink_${id}`} colorInterpolationFilters="sRGB" x="-8%" y="-30%" width="116%" height="160%">
          <feTurbulence
            ref={turb}
            type="fractalNoise"
            baseFrequency="0.28 0.25"
            numOctaves="1"
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
