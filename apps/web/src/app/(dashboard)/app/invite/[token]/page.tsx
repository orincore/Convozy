'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { API_BASE_URL, previewInvite } from '@/lib/api';
import type { TeamRole } from '@/lib/api';
import { GoogleIcon } from '@/components/dashboard/google-icon';

const ROLE_LABEL: Record<TeamRole, string> = { OWNER: 'an owner', ADMIN: 'an admin', MEMBER: 'an agent' };

/** Public page an invited teammate lands on. Joining happens when they sign in with the invited Google email. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<{ email: string; role: TeamRole; workspaceName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    previewInvite(token).then(setInvite).catch((err: Error) => setError(err.message));
  }, [token]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-card p-8 text-center">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-2.5 text-foreground">
          <Image src="/brand/logo-white.png" alt="" width={28} height={27} className="h-7 w-auto [[data-theme=light]_&]:invert" />
          <span className="text-lg font-semibold tracking-tight">Convozy</span>
        </Link>

        {!invite && !error && <CircleNotch size={22} className="mx-auto animate-spin text-muted-foreground" />}
        {error && (
          <div className="flex flex-col items-center gap-3">
            <WarningCircle size={26} className="text-danger" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Ask whoever invited you for a new link.</p>
          </div>
        )}
        {invite && (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Join {invite.workspaceName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You are invited as {ROLE_LABEL[invite.role]}. Sign in with the Google account for <span className="text-foreground">{invite.email}</span> to join.
            </p>
            <a
              href={`${API_BASE_URL}/auth/google`}
              className="mt-6 flex h-11 items-center justify-center gap-2.5 rounded-[var(--radius-control)] bg-accent text-sm font-medium text-accent-foreground transition-transform active:scale-[0.98]"
            >
              <GoogleIcon />
              Continue with Google
            </a>
            <p className="mt-4 text-xs text-muted-foreground">Using a different Google email will create a separate workspace instead.</p>
          </>
        )}
      </div>
    </div>
  );
}
