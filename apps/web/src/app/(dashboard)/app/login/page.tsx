'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { API_BASE_URL } from '@/lib/api';
import { storeTokens } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GoogleIcon } from '@/components/dashboard/google-icon';

/**
 * Login/register screen. Functional dashboard UI (taste-skill §13: out of
 * scope for landing-page choreography) - built with the shared shadcn-style
 * primitives in components/ui, same dark monochrome tokens as the marketing
 * site (CLAUDE.md §12a).
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const path = mode === 'login' ? '/auth/login' : '/auth/register';
    const body =
      mode === 'login' ? { email, password } : { email, password, name, workspaceName };

    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Request failed (${res.status})`);
      }
      const tokens = await res.json();
      storeTokens(tokens);
      router.replace('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <span className="text-sm font-bold">C</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Convozy</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'login' ? 'Log in' : 'Create your account'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Welcome back. Log in to manage your automations.'
                : 'Start automating your Instagram comments and DMs.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            <a
              href={`${API_BASE_URL}/auth/google`}
              className="flex h-10 w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </a>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'register' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="workspaceName">Workspace name</Label>
                    <Input
                      id="workspaceName"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 text-sm text-danger">
                  <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting && <CircleNotch size={16} className="animate-spin" />}
                {mode === 'login' ? 'Log in' : 'Sign up'}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
