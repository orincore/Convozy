'use client';

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

// Adapted from Spectrum UI's Animated Switch (spectrumhq.in/docs/animated-switch):
// same drag/flick gesture physics and press-to-stretch knob, ported from
// framer-motion to motion/react. Its neutral-900/white track already matched
// our locked monochrome tokens (CLAUDE.md §12a), so only bg-neutral-* was
// swapped for --color-* and the size scale trimmed to fit a table row
// (replaces a much larger 92x44px uiverse switch that read as oversized here).

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

interface GestureState {
  pointerId: number;
  originClientX: number;
  originKnobX: number;
  dragging: boolean;
  samples: { x: number; t: number }[];
}

const TRACK_PADDING = 2;
const STRETCH_FACTOR = 1.3;
const DRAG_START_DISTANCE = 3;
const FLICK_VELOCITY = 250;
const VELOCITY_SAMPLE_COUNT = 5;

const SNAPPY_SPRING = { type: 'spring', stiffness: 500, damping: 30 } as const;

const SIZES = {
  sm: { trackWidth: 30, trackHeight: 17 },
  md: { trackWidth: 38, trackHeight: 21 },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Switch({ checked, onCheckedChange, label, id, disabled = false, size = 'sm' }: SwitchProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const gesture = useRef<GestureState | null>(null);
  const suppressClick = useRef(false);

  const { trackWidth, trackHeight } = SIZES[size];
  const knobSize = trackHeight - TRACK_PADDING * 2;
  const stretchedWidth = Math.round(knobSize * STRETCH_FACTOR);
  const innerWidth = trackWidth - TRACK_PADDING * 2;
  const knobWidth = pressed && !reduce ? stretchedWidth : knobSize;
  const maxX = innerWidth - knobWidth;
  const knobX = dragX !== null ? clamp(dragX, 0, maxX) : checked ? maxX : 0;

  const handleClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onCheckedChange(!checked);
  }, [checked, onCheckedChange]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled || !event.isPrimary) return;
      suppressClick.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      const width = reduce ? knobSize : stretchedWidth;
      gesture.current = {
        pointerId: event.pointerId,
        originClientX: event.clientX,
        originKnobX: checked ? innerWidth - width : 0,
        dragging: false,
        samples: [{ x: event.clientX, t: event.timeStamp }],
      };
      setPressed(true);
    },
    [checked, disabled, innerWidth, knobSize, reduce, stretchedWidth],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = gesture.current;
    if (!state || event.pointerId !== state.pointerId) return;
    state.samples.push({ x: event.clientX, t: event.timeStamp });
    if (state.samples.length > VELOCITY_SAMPLE_COUNT) state.samples.shift();
    const deltaX = event.clientX - state.originClientX;
    if (!state.dragging && Math.abs(deltaX) < DRAG_START_DISTANCE) return;
    state.dragging = true;
    setDragX(state.originKnobX + deltaX);
  }, []);

  const endGesture = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPressed(false);
    setDragX(null);
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = gesture.current;
      if (!state || event.pointerId !== state.pointerId) return;
      if (state.dragging) {
        suppressClick.current = true;
        const width = reduce ? knobSize : stretchedWidth;
        const knobEnd = clamp(state.originKnobX + (event.clientX - state.originClientX), 0, innerWidth - width);
        const oldest = state.samples[0];
        const elapsed = event.timeStamp - oldest.t;
        const velocity = elapsed > 0 ? ((event.clientX - oldest.x) / elapsed) * 1000 : 0;
        const next = Math.abs(velocity) >= FLICK_VELOCITY ? velocity > 0 : knobEnd + width / 2 > innerWidth / 2;
        if (next !== checked) onCheckedChange(next);
      }
      endGesture(event);
    },
    [checked, endGesture, innerWidth, knobSize, onCheckedChange, reduce, stretchedWidth],
  );

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={endGesture}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer touch-manipulation select-none items-center rounded-full transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-success/90' : 'bg-muted',
      )}
      style={{ width: trackWidth, height: trackHeight }}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[max(100%,24px)] w-[max(100%,24px)] -translate-x-1/2 -translate-y-1/2"
      />
      <motion.span
        aria-hidden="true"
        className="absolute rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        style={{ top: TRACK_PADDING, left: TRACK_PADDING, height: knobSize }}
        initial={false}
        animate={{ x: knobX, width: knobWidth }}
        transition={reduce ? { duration: 0 } : SNAPPY_SPRING}
      />
    </button>
  );
}
