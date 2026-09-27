'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { clearAdminToken, getCurrentAdmin } from '@/lib/admin-auth';

export function AdminChrome({ children, wide = false }: { children: ReactNode; /** Edge-to-edge instead of the default 5xl cap — for dense tables/dossiers (users list, user detail). */ wide?: boolean }) {
  const router = useRouter();
  const admin = getCurrentAdmin();

  function logout() {
    clearAdminToken();
    router.replace('/admin/login');
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <Link href="/admin/users" className="text-sm font-semibold tracking-tight">
          Convozy Admin
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {admin && (
            <span>
              {admin.email} · {admin.role}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            <SignOut size={14} />
            Sign out
          </Button>
        </div>
      </header>
      <main className={cn('px-6 py-8', wide ? 'w-full' : 'mx-auto max-w-5xl')}>{children}</main>
    </div>
  );
}
