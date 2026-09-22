import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

/**
 * Root layout shared by both route groups. Route-specific metadata
 * (marketing pages) and noindex (dashboard) are set in each group's own
 * layout.tsx — see CLAUDE.md §11 and ARCHITECTURE.md §9.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'http://localhost:3001'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
