'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { API_BASE_URL } from '@/lib/api';
import { storeTokens } from '@/lib/auth';

/**
 * OAuth callback landing page. The API redirects here with a one-time
 * exchange `code` (never the JWTs themselves — see AuthService in the API),
 * which this page immediately exchanges for real tokens server-side.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      // Synchronous early-exit setState is fine here — there's no async
      // step to move it into, unlike the fetch below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Missing exchange code.');
      return;
    }

    fetch(`${API_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Exchange failed (${res.status})`);
        return res.json();
      })
      .then((tokens) => {
        storeTokens(tokens);
        router.replace('/app');
      })
      .catch((err: Error) => setError(err.message));
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <WarningCircle size={28} weight="bold" className="text-danger" />
        <p className="text-sm text-muted-foreground">Sign-in failed: {error}</p>
        <a href="/app/login" className="text-sm font-medium text-foreground underline underline-offset-2">
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3">
      <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in&hellip;</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3">
          <CircleNotch size={24} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Signing you in&hellip;</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
