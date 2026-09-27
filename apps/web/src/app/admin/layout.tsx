import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';

/** Internal ops tool, not a customer surface — noindex, same reasoning as (dashboard)/app/layout.tsx. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAuthGuard>{children}</AdminAuthGuard>;
}
