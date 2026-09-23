'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleNotch, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { ApiError, Contact, ListContactsResult, contactsApi } from '@/lib/api';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-border bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UsersThree size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No contacts yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A contact is created automatically the first time someone comments, replies to a story, or messages a
          connected account.
        </p>
      </div>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ContactsPage() {
  const [result, setResult] = useState<ListContactsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    contactsApi
      .list({ page })
      .then(setResult)
      .catch((err: ApiError) => setError(err.message));
  }, [page]);

  const contacts: Contact[] = result?.contacts ?? [];
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Contacts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone who has commented, replied to a story, or messaged a connected account.
      </p>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      <div className="mt-6">
        {result === null && !error && (
          <div className="flex items-center justify-center py-16">
            <CircleNotch size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {result && contacts.length === 0 && <EmptyState />}

        {result && contacts.length > 0 && (
          <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
            {contacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/app/contacts/${contact.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {contact.username ? `@${contact.username}` : contact.igScopedId}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Last seen {timeAgo(contact.lastInboundAt)}</p>
                </div>
                {contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map(({ tag }) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {result && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[var(--radius-control)] border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-[var(--radius-control)] border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
