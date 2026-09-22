'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardShell } from './shell';

const NO_CHROME_PATHS = ['/app/login'];

/** Skips the topbar/shell on auth pages, applies it everywhere else under /app. */
export function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (NO_CHROME_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
