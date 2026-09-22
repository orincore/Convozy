import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardChrome } from '@/components/dashboard/chrome';

/**
 * Authenticated dashboard shell — served under /app/*. Deliberately
 * `noindex` (ARCHITECTURE.md §9): there is no SEO reason to index a
 * logged-in app surface, so this layout never needs to satisfy the SSR/SEO
 * checklist in CLAUDE.md §11 the way (marketing) does.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <DashboardChrome>{children}</DashboardChrome>
    </AuthGuard>
  );
}
