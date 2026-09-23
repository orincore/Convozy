'use client';

import { useEffect, useState } from 'react';
import { CircleNotch, Plus, Tag as TagIcon, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, Tag, tagsApi } from '@/lib/api';

const SWATCHES = ['#fafafa', '#a1a1aa', '#4ade80', '#f87171', '#60a5fa', '#fbbf24'];

function EmptyState({ onFocusForm }: { onFocusForm: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-border bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TagIcon size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No tags yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Tags let you group contacts for targeted segments later.</p>
      </div>
      <Button size="sm" onClick={onFocusForm}>
        <Plus size={14} />
        Create a tag
      </Button>
    </div>
  );
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    tagsApi
      .list()
      .then(setTags)
      .catch((err: ApiError) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const tag = await tagsApi.create({ name: name.trim(), color });
      setTags((current) => [...(current ?? []), tag].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the tag');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const previous = tags;
    setTags((current) => (current ?? []).filter((t) => t.id !== id));
    try {
      await tagsApi.remove(id);
    } catch (err) {
      setTags(previous);
      setError(err instanceof ApiError ? err.message : 'Could not delete the tag');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Tags</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Label contacts manually or from an automation, then build segments on top of them.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-8 flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tag-name">New tag</Label>
          <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="vip" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <div className="flex h-10 items-center gap-1.5">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Use color ${swatch}`}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  color === swatch ? 'scale-110 border-foreground' : 'border-transparent'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting && <CircleNotch size={16} className="animate-spin" />}
          Add tag
        </Button>
      </form>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      <div className="mt-6">
        {tags === null && (
          <div className="flex items-center justify-center py-16">
            <CircleNotch size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {tags && tags.length === 0 && <EmptyState onFocusForm={() => document.getElementById('tag-name')?.focus()} />}

        {tags && tags.length > 0 && (
          <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: tag.color ?? undefined }}
                  />
                  <span className="text-sm font-medium text-foreground">{tag.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(tag.id)}
                  disabled={deletingId === tag.id}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50"
                  aria-label={`Delete ${tag.name}`}
                >
                  {deletingId === tag.id ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
