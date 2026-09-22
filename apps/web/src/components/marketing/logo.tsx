import Link from 'next/link';

/**
 * Wordmark, not a placeholder image. Simple geometric monogram + type,
 * matching the accent lock (taste-skill 4.2) — see globals.css tokens.
 */
export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-foreground">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect width="26" height="26" rx="8" className="fill-accent" />
        <path
          d="M8.5 13c0-2.49 2.01-4.5 4.5-4.5 1.4 0 2.65.64 3.48 1.64a.9.9 0 1 1-1.38 1.15A2.7 2.7 0 0 0 13 10.3a2.7 2.7 0 1 0 0 5.4c.83 0 1.58-.37 2.1-.95a.9.9 0 1 1 1.34 1.2A4.48 4.48 0 0 1 13 17.5c-2.49 0-4.5-2.01-4.5-4.5Z"
          className="fill-accent-foreground"
        />
      </svg>
      <span className="text-[1.05rem] font-semibold tracking-tight">Convozy</span>
    </Link>
  );
}
