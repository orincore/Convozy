'use client';

import { useMemo, useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';
import type { PointerEvent } from 'react';

const W = 1000;
const H = 420;
const COLS = 16;
const ROWS = 7;

/** Deterministic and rounded so server and browser render identical markup. */
function seeded(i: number) {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return Math.round((v - Math.floor(v)) * 1e4) / 1e4;
}

function Layer({ bright }: { bright: boolean }) {
  const { nodes, edges } = useMemo(() => {
    const nodes = Array.from({ length: COLS * ROWS }, (_, i) => ({
      x: Math.round(((i % COLS) + 0.5 + (seeded(i) - 0.5) * 0.4) * (W / COLS)),
      y: Math.round((Math.floor(i / COLS) + 0.5 + (seeded(i + 900) - 0.5) * 0.4) * (H / ROWS)),
    }));
    const edges: [number, number][] = [];
    nodes.forEach((a, i) =>
      nodes.forEach((b, j) => {
        if (j > i && Math.hypot(a.x - b.x, a.y - b.y) <= 100) edges.push([i, j]);
      }),
    );
    return { nodes, edges };
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <g stroke={bright ? 'rgba(250,250,250,0.55)' : 'rgba(250,250,250,0.07)'} strokeWidth={bright ? 1 : 0.7}>
        {edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />
        ))}
      </g>
      <g fill={bright ? '#fafafa' : 'rgba(250,250,250,0.22)'}>
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={bright ? 2.4 : 1.5} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Node lattice that lights up around the pointer. Adapted from Spectrum UI's
 * Neural Grid Footer (spectrumhq.in), simplified to two static SVG layers and
 * a pointer-driven mask so there is no per-frame React work.
 */
export function Lattice({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-999);
  const y = useMotionValue(-999);
  const mask = useMotionTemplate`radial-gradient(200px circle at ${x}px ${y}px, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%)`;

  function move(e: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    x.set(e.clientX - box.left);
    y.set(e.clientY - box.top);
  }

  return (
    <div
      ref={ref}
      onPointerMove={reduce ? undefined : move}
      onPointerLeave={() => {
        x.set(-999);
        y.set(-999);
      }}
      className="relative isolate overflow-hidden rounded-[var(--radius-card)] border border-border bg-card"
    >
      <div className="absolute inset-0 -z-10">
        <Layer bright={false} />
      </div>
      {!reduce && (
        <motion.div className="absolute inset-0 -z-10" style={{ WebkitMaskImage: mask, maskImage: mask }}>
          <Layer bright />
        </motion.div>
      )}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_50%,var(--color-card)_15%,transparent_75%)]" />
      {children}
    </div>
  );
}
