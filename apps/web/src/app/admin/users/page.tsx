'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleNotch, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import { AdminChrome } from '@/components/admin/admin-chrome';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api';
import { adminUsersApi, AdminUserListResponse } from '@/lib/admin-api';

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    setError(null);
    const timer = setTimeout(() => {
      adminUsersApi
        .list({ q: q || undefined, page, pageSize: PAGE_SIZE })
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch((err: ApiError) => {
          if (!cancelled) setError(err.message);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, page]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminChrome wide>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every account across every workspace on Convozy.</p>
        </div>

        <div className="relative max-w-sm">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <WarningCircle size={14} />
            {error}
          </p>
        )}

        {!data && !error && (
          <div className="flex items-center justify-center py-16">
            <CircleNotch size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No users match.</p>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Workspace</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                        {u.name || u.email}
                      </Link>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.workspaceName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {u.isSuspended ? <Badge className="text-danger">Suspended</Badge> : <Badge variant="outline">Active</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {data.page} of {totalPages} · {data.total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-[var(--radius-control)] border border-border px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-[var(--radius-control)] border border-border px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminChrome>
  );
}
