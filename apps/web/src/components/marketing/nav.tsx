'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { Logo } from './logo';
import { CtaButton } from './cta-button';

const NAV_LINKS = [
  { href: '/features/comment-to-dm', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
];

const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

/** Floating glass pill nav; on mobile the burger morphs to an X and opens a full-screen menu. */
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-foreground/70"
      />
      <header className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-40 flex justify-center px-4">
        <nav
          aria-label="Main"
          className="flex w-full max-w-3xl items-center justify-between rounded-full border border-white/10 bg-background/60 py-2 pl-5 pr-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl"
        >
          <Logo />

          <ul className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors duration-300 hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Link
              href="/app/login"
              className="hidden px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Log in
            </Link>
            <CtaButton href="/app/login" className="hidden md:inline-flex">
              Start free
            </CtaButton>
            <button
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="relative grid size-10 place-items-center rounded-full bg-white/10 md:hidden"
            >
              <motion.span
                className="absolute h-px w-4 bg-foreground"
                animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }}
                transition={{ duration: 0.4, ease: EASE }}
              />
              <motion.span
                className="absolute h-px w-4 bg-foreground"
                animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }}
                transition={{ duration: 0.4, ease: EASE }}
              />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-30 flex flex-col justify-center gap-4 bg-background/85 px-8 backdrop-blur-3xl md:hidden"
          >
            {[...NAV_LINKS, { href: '/app/login', label: 'Log in' }].map((link, i) => (
              <div key={link.href} className="overflow-hidden">
                <motion.div
                  initial={{ y: 48, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: EASE }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="font-display text-4xl font-semibold tracking-tight"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              </div>
            ))}
            <div className="mt-6">
              <CtaButton href="/app/login">Start free</CtaButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
