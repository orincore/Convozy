'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CircleNotch, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  ApiError,
  CustomField,
  Segment,
  SegmentRule,
  SegmentRuleOp,
  Tag,
  customFieldsApi,
  segmentsApi,
  tagsApi,
} from '@/lib/api';

// A single-level ALL/ANY rule builder — the backend (SegmentsService)
// supports arbitrarily nested all/any/tag/field trees (tested, deployed),
// but a flat "match ALL/ANY of these conditions" list covers the common
// segmentation need without the complexity of a full nested-group tree
// editor. A deliberate, documented v1 scope (CLAUDE.md §14) — nested
// groups can be added to this page later with zero backend changes.
type ConditionRow =
  | { kind: 'tag'; tagId: string }
  | { kind: 'field'; fieldId: string; op: SegmentRuleOp; value: string };

function emptyTagRow(firstTagId: string): ConditionRow {
  return { kind: 'tag', tagId: firstTagId };
}

const OPS: { value: SegmentRuleOp; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
];

export default function NewSegmentPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [fields, setFields] = useState<CustomField[] | null>(null);
  const [name, setName] = useState('');
  const [matchAll, setMatchAll] = useState(true);
  const [rows, setRows] = useState<ConditionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([tagsApi.list(), customFieldsApi.list()])
      .then(([t, f]) => {
        setTags(t);
        setFields(f);
        if (t.length > 0) setRows([emptyTagRow(t[0].id)]);
      })
      .catch((err: ApiError) => setError(err.message));
  }, []);

  function updateRow(index: number, patch: Partial<ConditionRow>) {
    setRows((current) => current.map((r, i) => (i === index ? ({ ...r, ...patch } as ConditionRow) : r)));
  }

  function addTagRow() {
    if (!tags || tags.length === 0) return;
    setRows((current) => [...current, emptyTagRow(tags[0].id)]);
  }

  function addFieldRow() {
    if (!fields || fields.length === 0) return;
    setRows((current) => [...current, { kind: 'field', fieldId: fields[0].id, op: 'eq', value: '' }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Give this segment a name.');
      return;
    }
    if (rows.length === 0) {
      setError('Add at least one condition.');
      return;
    }
    if (rows.some((r) => r.kind === 'field' && r.value.trim() === '')) {
      setError('Every field condition needs a value.');
      return;
    }

    const conditions: SegmentRule[] = rows.map((row) =>
      row.kind === 'tag'
        ? { tag: tags?.find((t) => t.id === row.tagId)?.name ?? '' }
        : { field: { key: fields?.find((f) => f.id === row.fieldId)?.key ?? '', op: row.op, value: row.value } },
    );
    const rules: SegmentRule = matchAll ? { all: conditions } : { any: conditions };

    setSubmitting(true);
    try {
      const segment: Segment = await segmentsApi.create({ name: name.trim(), rules });
      router.push('/app/segments');
      void segment;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the segment');
      setSubmitting(false);
    }
  }

  if (tags === null || fields === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tags.length === 0 && fields.length === 0) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm text-muted-foreground">
          Create at least one tag or custom field before building a segment.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" asChild>
            <Link href="/app/tags">Create a tag</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/app/custom-fields">Create a custom field</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/segments" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Segments
      </Link>

      <h1 className="mt-4 text-xl font-semibold">New segment</h1>
      <p className="mt-1 text-sm text-muted-foreground">Evaluated live every time — never stale, never cached.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="segment-name">Name</Label>
          <Input id="segment-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VIPs in NYC" />
        </div>

        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Match</h2>
            <Select value={matchAll ? 'all' : 'any'} onChange={(e) => setMatchAll(e.target.value === 'all')} className="w-32">
              <option value="all">ALL of</option>
              <option value="any">ANY of</option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border p-2.5">
                {row.kind === 'tag' ? (
                  <>
                    <span className="text-xs text-muted-foreground">has tag</span>
                    <Select
                      value={row.tagId}
                      onChange={(e) => updateRow(index, { tagId: e.target.value })}
                      className="h-8 flex-1"
                    >
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </>
                ) : (
                  <>
                    <Select
                      value={row.fieldId}
                      onChange={(e) => updateRow(index, { fieldId: e.target.value })}
                      className="h-8 w-32"
                    >
                      {fields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={row.op}
                      onChange={(e) => updateRow(index, { op: e.target.value as SegmentRuleOp })}
                      className="h-8 w-36"
                    >
                      {OPS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) => updateRow(index, { value: e.target.value })}
                      placeholder="value"
                      className="h-8 flex-1"
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                  aria-label="Remove condition"
                >
                  <Trash size={13} />
                </button>
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No conditions yet.</p>}
          </div>

          <div className="flex gap-2">
            {tags.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={addTagRow}>
                <Plus size={13} />
                Tag condition
              </Button>
            )}
            {fields.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={addFieldRow}>
                <Plus size={13} />
                Field condition
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <WarningCircle size={16} weight="bold" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting && <CircleNotch size={16} className="animate-spin" />}
            Create segment
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/app/segments">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
