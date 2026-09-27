'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAdminToken } from '@/lib/admin-auth';

const PUBLIC_PATHS = ['/admin/login'];

/** Mirrors components/auth-guard.tsx, scoped to the separate admin token — see lib/admin-auth.ts. */
export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    setChecked(true);
  }, [pathname, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!checked) return null;
  return <>{children}</>;
}
