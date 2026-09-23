'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle } from '@phosphor-icons/react';
import { API_BASE_URL } from '@/lib/api';
import { GoogleIcon } from '@/components/dashboard/google-icon';

/**
 * Login screen. Google is the only way in (it also creates the account for
 * new people), so there is no sign-up page and no password form. Split layout:
 * a brand panel on large screens and the card on the right, in a double-bezel
 * card after Spectrum UI's Login Card.
 */
const EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

const PERKS = [
  'Every feature is free, with no card needed',
  'Live in minutes, no code',
  'Disconnect Instagram any time',
];

export default function LoginPage() {
  const reduce = useReducedMotion();

  return (
    <div className="relative grid min-h-[100dvh] overflow-hidden lg:grid-cols-2">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 size-[32rem] rounded-full bg-white/[0.06] blur-[120px]" />

      {/* brand panel */}
      <div className="relative hidden flex-col justify-between p-12 lg:flex">
        <Link href="/" className="flex w-fit items-center gap-2.5 text-foreground">
          <Image src="/brand/logo-white.png" alt="" width={32} height={31} className="h-8 w-auto" />
          <span className="text-xl font-semibold tracking-tight">Convozy</span>
        </Link>

        <div>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="font-display max-w-md text-5xl font-semibold leading-[1.05] tracking-tight text-balance"
          >
            Welcome back. Your DMs missed you.
          </motion.h1>
          <ul className="mt-10 flex max-w-md flex-col gap-3">
            {PERKS.map((p, i) => (
              <motion.li
                key={p}
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.3 + i * 0.1, ease: EASE }}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 text-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
              >
                <CheckCircle size={18} weight="fill" />
                {p}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">
          A product of Orincore,{' '}
          <a href="https://www.orincore.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">www.orincore.com</a>
        </p>
      </div>

      {/* sign-in card */}
      <div className="relative flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-foreground lg:hidden">
            <Image src="/brand/logo-white.png" alt="" width={28} height={27} className="h-7 w-auto" />
            <span className="text-lg font-semibold tracking-tight">Convozy</span>
          </Link>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: EASE }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5"
          >
            <div className="rounded-[calc(2rem-0.375rem)] bg-card p-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] sm:p-9">
              <h2 className="font-display text-3xl font-semibold tracking-tight">Log in</h2>
              <p className="mt-2 text-muted-foreground">
                One tap with Google. New here? It sets up your account too.
              </p>

              <a
                href={`${API_BASE_URL}/auth/google`}
                className="group mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent text-base font-medium text-accent-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
              >
                <span className="grid size-8 place-items-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
                  <GoogleIcon className="h-4 w-4" />
                </span>
                Continue with Google
              </a>
            </div>
          </motion.div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
