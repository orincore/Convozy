'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleNotch, FunnelSimple, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ApiError, Segment, segmentsApi } from '@/lib/api';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-border bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FunnelSimple size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No segments yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Build a reusable audience from tags and custom fields.</p>
      </div>
      <Button size="sm" asChild>
        <Link href="/app/segments/new">
          <Plus size={14} />
          New segment
        </Link>
      </Button>
    </div>
  );
}

function SegmentCount({ segmentId }: { segmentId: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    segmentsApi
      .count(segmentId)
      .then((r) => setCount(r.count))
      .catch(() => setCount(null));
  }, [segmentId]);
  if (count === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {count} contact{count === 1 ? '' : 's'}
    </span>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    segmentsApi
      .list()
      .then(setSegments)
      .catch((err: ApiError) => setError(err.message));
  }

  useEffect(load, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const previous = segments;
    setSegments((current) => (current ?? []).filter((s) => s.id !== id));
    try {
      await segmentsApi.remove(id);
    } catch (err) {
      setSegments(previous);
      setError(err instanceof ApiError ? err.message : 'Could not delete the segment');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Segments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reusable, always-fresh filters over your contacts.</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/app/segments/new">
            <Plus size={14} />
            New segment
          </Link>
        </Button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      <div className="mt-6">
        {segments === null && (
          <div className="flex items-center justify-center py-16">
            <CircleNotch size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {segments && segments.length === 0 && <EmptyState />}

        {segments && segments.length > 0 && (
          <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
            {segments.map((segment) => (
              <div key={segment.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{segment.name}</p>
                  <SegmentCount segmentId={segment.id} />
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(segment.id)}
                  disabled={deletingId === segment.id}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50"
                  aria-label={`Delete ${segment.name}`}
                >
                  {deletingId === segment.id ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
