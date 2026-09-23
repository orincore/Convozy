'use client';

import { useEffect } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

const container = {
  hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
  visible: { transition: { staggerChildren: 0.07 } },
};

const char = {
  hidden: { opacity: 0, y: '0.35em', filter: 'blur(10px)', transition: { duration: 0.45, ease: EASE } },
  visible: { opacity: 1, y: '0em', filter: 'blur(0px)', transition: { duration: 1.4, ease: EASE } },
};

/**
 * Headline words that rise out of a soft blur one letter at a time, hold,
 * fade back out and play again. Only transform, opacity and a small blur are
 * animated, so it runs on the GPU and stays smooth (the earlier SVG noise
 * filter was recalculated on the CPU every frame and stuttered).
 */
export function InkReveal({ text, holdMs = 6000 }: { text: string; holdMs?: number }) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();

  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (!cancelled) {
        await controls.start('visible');
        await wait(holdMs);
        if (cancelled) return;
        await controls.start('hidden');
        await wait(350);
      }
    })();
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [controls, reduce, holdMs]);

  if (reduce) return <span>{text}</span>;

  return (
    <motion.span
      aria-label={text}
      className="inline-block whitespace-nowrap"
      variants={container}
      initial="hidden"
      animate={controls}
    >
      {text.split('').map((c, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          variants={char}
          className="inline-block will-change-[transform,opacity,filter]"
        >
          {c === ' ' ? ' ' : c}
        </motion.span>
      ))}
    </motion.span>
  );
}
