import type { ReactNode } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

const SITE_NAME = 'Convozy';
const SITE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001';

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
    <>
      <JsonLd data={organizationJsonLd} />
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </>
  );
}
