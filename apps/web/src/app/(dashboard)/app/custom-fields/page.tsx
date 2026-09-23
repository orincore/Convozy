'use client';

import { useEffect, useState } from 'react';
import { CircleNotch, Plus, SlidersHorizontal, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ApiError, CustomField, CustomFieldType, customFieldsApi } from '@/lib/api';

const TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'BOOLEAN', label: 'Yes / No' },
  { value: 'DATE', label: 'Date' },
];

function EmptyState({ onFocusForm }: { onFocusForm: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-border bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SlidersHorizontal size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No custom fields yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Store structured data per contact (city, order number, plan) and filter segments on it.
        </p>
      </div>
      <Button size="sm" onClick={onFocusForm}>
        <Plus size={14} />
        Create a field
      </Button>
    </div>
  );
}

function slugifyKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXT');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    customFieldsApi
      .list()
      .then(setFields)
      .catch((err: ApiError) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const key = slugifyKey(label);
    if (!label.trim() || !key) return;
    setSubmitting(true);
    setError(null);
    try {
      const field = await customFieldsApi.create({ key, label: label.trim(), type });
      setFields((current) => [...(current ?? []), field].sort((a, b) => a.label.localeCompare(b.label)));
      setLabel('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the field');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const previous = fields;
    setFields((current) => (current ?? []).filter((f) => f.id !== id));
    try {
      await customFieldsApi.remove(id);
    } catch (err) {
      setFields(previous);
      setError(err instanceof ApiError ? err.message : 'Could not delete the field');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Custom fields</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Structured data you can set per contact and filter segments on.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-8 flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="field-label">Field name</Label>
          <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="City" />
          {label.trim() && <p className="text-xs text-muted-foreground">Key: {slugifyKey(label) || '—'}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-type">Type</Label>
          <Select id="field-type" value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={submitting || !label.trim()}>
          {submitting && <CircleNotch size={16} className="animate-spin" />}
          Add field
        </Button>
      </form>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      <div className="mt-6">
        {fields === null && (
          <div className="flex items-center justify-center py-16">
            <CircleNotch size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {fields && fields.length === 0 && (
          <EmptyState onFocusForm={() => document.getElementById('field-label')?.focus()} />
        )}

        {fields && fields.length > 0 && (
          <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                  <p className="text-xs text-muted-foreground">{field.key}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{TYPES.find((t) => t.value === field.type)?.label ?? field.type}</Badge>
                  <button
                    type="button"
                    onClick={() => handleDelete(field.id)}
                    disabled={deletingId === field.id}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50"
                    aria-label={`Delete ${field.label}`}
                  >
                    {deletingId === field.id ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
