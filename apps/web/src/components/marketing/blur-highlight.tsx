'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Word-by-word blur-in reveal with specific words highlighted, built
 * natively with Motion (staggerChildren + per-word variants). Same visual
 * effect as React Bits Pro's "Blur Highlight" component, without the paid
 * license/registry this repo doesn't have configured - see TRACKER.md
 * Phase 0.6c.
 *
 * `highlight` takes exact word strings (case-sensitive, matched whole-word)
 * to render in the foreground color instead of muted; everything else
 * blurs/fades in at the muted tone.
 */
export function BlurHighlight({
  text,
  highlight = [],
  className,
  as: Tag = 'p',
}: {
  text: string;
  highlight?: string[];
  className?: string;
  as?: 'p' | 'span';
}) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  const highlightSet = new Set(highlight);

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.035 } },
  };

  const word = {
    hidden: reduce ? {} : { opacity: 0, filter: 'blur(8px)', y: 6 },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <Tag className={className}>
      <motion.span
        variants={container}
        initial={reduce ? undefined : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.6 }}
        className="inline"
      >
        {words.map((raw, index) => {
          const isHighlighted = highlightSet.has(raw.replace(/[.,!?]$/, ''));
          return (
            <motion.span
              key={`${raw}-${index}`}
              variants={word}
              className={`inline-block ${isHighlighted ? 'text-foreground font-medium' : ''}`}
            >
              {raw}
              {index < words.length - 1 ? ' ' : ''}
            </motion.span>
          );
        })}
      </motion.span>
    </Tag>
  );
}
