'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';

const PUBLIC_PATHS = ['/app/login'];

/** Redirects to /app/login when there's no stored access token. Dev-stage — see lib/auth.ts. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  // Reading localStorage only works client-side, so this genuinely has to
  // run post-mount rather than during render — the recommended
  // useSyncExternalStore alternative isn't worth the extra indirection for
  // this dev-stage guard (TODO Phase 4: replace with real session state).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }
    if (!getAccessToken()) {
      router.replace('/app/login');
      return;
    }
    setChecked(true);
  }, [pathname, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!checked) return null;
  return <>{children}</>;
}
