'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleNotch } from '@phosphor-icons/react';
import { CONNECT_MESSAGE_TYPE } from '@/lib/connect-instagram';

/**
 * Where the Instagram connect popup lands. It reports the outcome to the
 * dashboard window that opened it and closes; opened on its own (popup
 * blocked, full-page redirect) it just sends the person back to Accounts.
 */
function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get('status') === 'connected' ? 'connected' : 'error';
  const message = params.get('message') ?? undefined;

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: CONNECT_MESSAGE_TYPE, status, message }, window.location.origin);
      window.close();
      return;
    }
    router.replace(status === 'connected' ? '/app?instagram=connected' : `/app?instagram_error=${encodeURIComponent(message ?? 'Could not connect')}`);
  }, [status, message, router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center gap-3 text-sm text-muted-foreground">
      <CircleNotch size={18} className="animate-spin" />
      {status === 'connected' ? 'Account connected. You can close this window.' : 'Finishing up...'}
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
