import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * OAuth callback routes have no content value for search and can carry
 * transient exchange-code query strings - noindex here backs up the
 * robots.txt `Disallow: /auth/` (same belt-and-suspenders pattern as the
 * dashboard route group's noindex).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
