'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { CheckCircle, Copy, EnvelopeSimple, Heart } from '@phosphor-icons/react';
import { DONATE_EMAIL, DONATE_UPI, DONATE_URL } from '@/lib/donate';

const AMOUNTS = [100, 250, 500, 1000];
const MIN = 10;
const MAX = 100000;
const SPRING = { type: 'spring', stiffness: 380, damping: 26 } as const;

/** Radial burst of small hearts, replayed by changing `burstKey` (after Spectrum UI's Like Button). */
function HeartBurst({ burstKey }: { burstKey: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative grid size-14 place-items-center rounded-full bg-white/10">
      <motion.span key={`h${burstKey}`} animate={reduce ? undefined : { scale: [1, 1.35, 1] }} transition={{ duration: 0.45 }}>
        <Heart size={26} weight="fill" />
      </motion.span>
      {!reduce &&
        burstKey > 0 &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <motion.span
              key={`${burstKey}-${i}`}
              className="absolute size-1.5 rounded-full bg-white"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          );
        })}
    </span>
  );
}

const THANKS = [
  'You just made a creator\'s day. Thank you!',
  '{amount}? You are officially our favourite person today.',
  'Legend behaviour. Thank you for keeping Convozy alive.',
  'Somewhere, a small creator just got free automation because of you.',
  'We would hug you through the screen if we could.',
  'Unlike your ex, you actually showed up. Thank you!',
  'You are the reason our servers are smiling.',
  'Big heart energy detected. Thank you so much!',
  '{amount} of pure kindness. We are not crying, you are.',
];
const MORPH = { type: 'spring', stiffness: 260, damping: 22 } as const;
const SPARKLES = 6;
const STAR = 'M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z';

/**
 * A friendlier face than the outline version. It is a solid, softly glowing
 * face with eyes that follow the caret or the pointer, a blink every few
 * seconds and a gentle breathing float. On a thank-you the mouth morphs into a
 * smile (an open, laughing one for big amounts), cheeks blush in, a ring pulses
 * out and sparkles burst off it.
 * Adapted from Spectrum UI: the morphing mouth and eyes are from Face Rating,
 * the sparkle burst is from Star Rating. Monochrome, so mood is carried by the
 * shapes and light, not by color.
 */
function ThankFace({ look, mood, bounceKey, following }: { look: number; mood: number; bounceKey: number; following: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const spring = reduce ? { duration: 0 } : MORPH;
  const smile = ['M 24 47 Q 36 48.5 48 47', 'M 23 45.5 Q 36 54 49 45.5', 'M 22 45 Q 36 58 50 45', ''][mood];
  const open = mood >= 3;

  // Eye offsets live in motion values: pointer tracking never re-renders React.
  const tx = useMotionValue(0);
  const ty = useMotionValue(-3);
  const sx = useSpring(tx, { stiffness: 200, damping: 18 });
  const sy = useSpring(ty, { stiffness: 200, damping: 18 });

  useEffect(() => {
    if (following) return;
    tx.set(look * 3.2);
    ty.set(mood === 0 ? -3 : -0.8);
  }, [following, look, mood, tx, ty]);

  useEffect(() => {
    if (!following || reduce) return;
    const move = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, len / 240);
      tx.set((dx / len) * 3.4 * reach);
      ty.set((dy / len) * 3.6 * reach);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [following, reduce, tx, ty]);

  return (
    <div ref={ref} aria-hidden="true" className="relative mx-auto grid size-28 place-items-center">
      <motion.span
        className="absolute inset-2 rounded-full bg-white/25 blur-2xl"
        animate={reduce ? undefined : { opacity: mood ? [0.5, 1, 0.5] : [0.25, 0.45, 0.25], scale: [0.9, 1.08, 0.9] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {!reduce && mood > 0 && (
        <motion.span
          key={`ring${bounceKey}`}
          className="absolute inset-4 rounded-full border border-white/60"
          initial={{ scale: 0.9, opacity: 0.8 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}
      <motion.div
        key={bounceKey}
        initial={false}
        animate={
          reduce
            ? undefined
            : bounceKey === 0
              ? { y: [0, -3, 0], scale: [1, 1.02, 1] }
              : { scale: [1, 1.18, 0.96, 1], y: [0, -10, 0, 0], rotate: [0, -6, 4, 0] }
        }
        transition={bounceKey === 0 ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6, times: [0, 0.35, 0.7, 1], ease: 'easeOut' }}
        className="relative"
      >
        <svg viewBox="-14 -14 100 100" width={112} height={112} fill="none" strokeLinecap="round" overflow="visible">
          <defs>
            <radialGradient id="face-fill" cx="40%" cy="32%" r="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#c9c9cf" />
            </radialGradient>
          </defs>
          <circle cx={36} cy={36} r={30} fill="url(#face-fill)" />
          <circle cx={36} cy={36} r={30} stroke="rgba(0,0,0,0.12)" strokeWidth={1.5} />

          <motion.ellipse cx={16.5} cy={41} rx={4.4} ry={2.8} fill="#0a0a0b" stroke="none" initial={false} animate={{ opacity: mood ? 0.14 : 0 }} transition={spring} />
          <motion.ellipse cx={55.5} cy={41} rx={4.4} ry={2.8} fill="#0a0a0b" stroke="none" initial={false} animate={{ opacity: mood ? 0.14 : 0 }} transition={spring} />

          {[25, 47].map((cx) => (
            <motion.g key={cx} style={{ x: sx, y: sy }}>
              <motion.ellipse
                cx={cx}
                cy={30}
                rx={4.2}
                ry={5.2}
                fill="#0a0a0b"
                stroke="none"
                style={{ originX: `${cx}px`, originY: '30px' }}
                animate={reduce ? undefined : { scaleY: [1, 1, 0.08, 1] }}
                transition={{ duration: 0.3, times: [0, 0.94, 0.97, 1], repeat: Infinity, repeatDelay: 3.2 }}
              />
              <circle cx={cx + 1.4} cy={28} r={1.4} fill="#ffffff" stroke="none" />
            </motion.g>
          ))}

          <motion.path d={smile || 'M 24 47 Q 36 48.5 48 47'} stroke="#0a0a0b" strokeWidth={3.6} initial={false} animate={{ d: smile || 'M 24 47 Q 36 48.5 48 47', opacity: open ? 0 : 1 }} transition={spring} />
          <motion.g initial={false} animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.6 }} transition={spring} style={{ originX: '36px', originY: '46px' }}>
            <path d="M 22 45 Q 36 46 50 45 Q 48 62 36 62 Q 24 62 22 45 Z" fill="#0a0a0b" stroke="none" />
            <path d="M 28 58 Q 36 52 44 58 Q 40 63 36 63 Q 32 63 28 58 Z" fill="#f4a3b0" stroke="none" opacity={0.85} />
          </motion.g>

          {!reduce &&
            mood > 0 &&
            Array.from({ length: SPARKLES }, (_, i) => {
              const ang = (i / SPARKLES) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.path
                  key={`${bounceKey}-${i}`}
                  d={STAR}
                  fill="#ffffff"
                  stroke="none"
                  initial={{ x: 36, y: 36, opacity: 1, scale: 0.4 }}
                  animate={{ x: 36 + Math.cos(ang) * 50, y: 36 + Math.sin(ang) * 50, opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                />
              );
            })}
        </svg>
      </motion.div>
    </div>
  );
}

export function DonateForm() {
  const [amount, setAmount] = useState<number | null>(250);
  const [custom, setCustom] = useState('');
  const [burst, setBurst] = useState(0);
  const [copied, setCopied] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [seed, setSeed] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);

  const valid = amount !== null && amount >= MIN && amount <= MAX;

  useEffect(() => {
    if (custom === '') {
      const clear = setTimeout(() => {
        setSeed(null);
        setTyping(false);
      }, 0);
      return () => clearTimeout(clear);
    }
    const t = setTimeout(
      () => {
        setTyping(false);
        setSeed((prev) => (prev === null ? Math.floor(Math.random() * THANKS.length) : (prev + 1 + Math.floor(Math.random() * (THANKS.length - 1))) % THANKS.length));
      },
      750,
    );
    return () => clearTimeout(t);
  }, [custom]);
  const pick = (n: number) => {
    setAmount(n);
    setCustom('');
    setBurst((b) => b + 1);
  };
  const onCustom = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '').slice(0, 6);
    setCustom(digits);
    setAmount(digits ? Number(digits) : null);
    setTyping(digits !== '');
  };

  const upiLink = valid
    ? `upi://pay?pa=${encodeURIComponent(DONATE_UPI)}&pn=Convozy&am=${amount}&cu=INR&tn=${encodeURIComponent('Convozy donation')}`
    : '#';
  const mailLink = `mailto:${DONATE_EMAIL}?subject=${encodeURIComponent('I want to donate to Convozy')}&body=${encodeURIComponent(
    valid ? `I would like to donate ${amount} rupees. Please send me the payment details.` : 'I would like to donate. Please send me the payment details.',
  )}`;
  const noMethod = !DONATE_UPI && !DONATE_URL;
  const done = seed !== null && !typing && custom !== '' && amount !== null && amount > 0;

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(DONATE_UPI);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copy this UPI ID', DONATE_UPI);
    }
  }

  const primary =
    'flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-base font-medium text-accent-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]';
  const secondary =
    'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-medium transition-transform duration-300 active:scale-[0.98]';
  const disabled = valid ? '' : 'pointer-events-none opacity-50';

  return (
    <div className="rounded-[2rem] border border-white/15 bg-white/[0.04] p-1.5">
      <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] sm:p-8">
        <div className="flex items-center gap-4">
          <HeartBurst burstKey={burst} />
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Pick an amount</h2>
            <p className="text-sm text-muted-foreground">Any amount you like. Every bit helps.</p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Donation amount">
          {AMOUNTS.map((n) => {
            const on = amount === n && custom === '';
            return (
              <button
                key={n}
                role="radio"
                aria-checked={on}
                onClick={() => pick(n)}
                className="relative h-12 rounded-2xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {on && <motion.span layoutId="amt-pill" transition={SPRING} className="absolute inset-0 rounded-2xl bg-accent" />}
                {!on && <span className="absolute inset-0 rounded-2xl bg-white/[0.07]" />}
                <span className={`relative ${on ? 'text-accent-foreground' : ''}`}>₹{n.toLocaleString('en-IN')}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex h-12 items-center gap-2 rounded-2xl bg-white/[0.07] px-4 text-sm focus-within:ring-2 focus-within:ring-accent/60">
          <span className="text-muted-foreground">Your own amount ₹</span>
          <input
            inputMode="numeric"
            value={custom}
            onChange={(e) => {
              onCustom(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            placeholder="Any number"
            aria-label="Your own amount in rupees"
            className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/70"
          />
        </label>
        <p className="mt-2 min-h-5 text-xs text-muted-foreground">
          {amount !== null && !valid ? `Please enter an amount between ₹${MIN} and ₹${MAX.toLocaleString('en-IN')}.` : ''}
        </p>

        <div className="mt-2 flex min-h-[10.5rem] flex-col items-center justify-start rounded-2xl bg-white/[0.05] px-4 py-4 text-center">
          <ThankFace
            look={custom === '' ? 0 : Math.max(-1, Math.min(1, -0.9 + (Math.min(caret, 6) / 6) * 1.8))}
            mood={done ? (amount! < 100 ? 1 : amount! < 500 ? 2 : 3) : 0}
            bounceKey={done ? (seed ?? 0) + 1 : 0}
            following={!focused}
          />
          <div className="mt-3 min-h-10" role="status">
            <AnimatePresence mode="wait">
              {!done && !typing && (
                <motion.p
                  key="idle"
                  initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="text-sm font-medium text-muted-foreground"
                >
                  Your donation will help us keep Convozy alive.
                </motion.p>
              )}
              {done && (
                <motion.p
                  key={seed}
                  initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="text-sm font-medium"
                >
                  {THANKS[seed!].replace('{amount}', `₹${amount!.toLocaleString('en-IN')}`)}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {DONATE_UPI && (
            <>
              <a href={upiLink} onClick={() => {
                  if (valid) {
                    setBurst((b) => b + 1);
                    setThanks(true);
                  }
                }} className={`${primary} ${disabled}`}>
                <Heart size={18} weight="fill" /> Donate {valid ? `₹${amount!.toLocaleString('en-IN')}` : ''} with UPI
              </a>
              <button type="button" onClick={copyUpi} className={secondary}>
                {copied ? <CheckCircle size={18} weight="fill" className="text-success" /> : <Copy size={18} />}
                {copied ? 'UPI ID copied' : `On a computer? Copy the UPI ID`}
              </button>
            </>
          )}
          {DONATE_URL && (
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={() => setThanks(true)} className={DONATE_UPI ? secondary : primary}>
              <Heart size={18} weight="fill" /> Pay by card or other currency
            </a>
          )}
          {noMethod && (
            <div className="rounded-2xl bg-white/[0.06] p-4 text-sm">
              <p className="font-medium">Online payments are being set up.</p>
              <p className="mt-1 text-muted-foreground">
                Tell us the amount and we will send you the payment details straight away.
              </p>
              <a href={mailLink} onClick={() => valid && setThanks(true)} className={`${primary} mt-4 ${disabled}`}>
                <EnvelopeSimple size={18} weight="bold" /> Email us to donate
              </a>
            </div>
          )}
        </div>

        <AnimatePresence>
          {thanks && (
            <motion.p
              key="thanks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-center text-sm text-muted-foreground"
            >
              Thank you. Seriously.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
