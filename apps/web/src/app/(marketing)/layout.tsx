import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { JsonLd } from '@/components/seo/json-ld';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';
import { MarketingBackdrop } from '@/components/marketing/backdrop';
import { ScrollBlur } from '@/components/marketing/scroll-blur';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
};

const SITE_NAME = 'Convozy';
const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

/**
 * Display face for marketing headlines only (`.font-display`, see
 * globals.css `--font-display`) - self-hosted via next/font, never a
 * `<link>` tag (taste-skill 3.A). Scoped to this route group so the
 * dashboard keeps plain Geist, per the "front page only" instruction.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
});

/**
 * Public marketing site shell — SSR, indexed, SEO-critical (CLAUDE.md §11,
 * ARCHITECTURE.md §9). The dashboard route group has its own layout with
 * `robots: noindex` instead. Design per `taste-skill` (CLAUDE.md §12) —
 * see globals.css for the shared token system.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Automate Instagram comment replies and DMs. Turn "comment X" posts into automatic, instant DM delivery - free to start.',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <div className={`${spaceGrotesk.variable} relative`}>
      <JsonLd data={organizationJsonLd} />
      <MarketingBackdrop />
      <div className="relative z-10">
        <ScrollBlur />
        <MarketingNav />
        <main className="pt-20">{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}
