'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlass, Plus, Lightning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AutomationTemplate, TriggerSource } from '@/lib/api';

const SOURCE_FILTERS: { value: TriggerSource; label: string }[] = [
  { value: 'COMMENT', label: 'Post or Reel comment' },
  { value: 'DM', label: 'DM' },
  { value: 'STORY_REPLY', label: 'Story reply' },
  { value: 'LIVE_COMMENT', label: 'Live comment' },
  { value: 'STORY_MENTION', label: 'Story mention' },
  { value: 'REFERRAL', label: 'ig.me link or ad' },
];

const SOURCE_LABELS: Record<TriggerSource, string> = {
  COMMENT: 'Comment',
  DM: 'DM',
  STORY_REPLY: 'Story reply',
  LIVE_COMMENT: 'Live comment',
  STORY_MENTION: 'Story mention',
  REFERRAL: 'ig.me link / ad',
};

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: AutomationTemplate[] | null;
  error: string | null;
  onUse: (template: AutomationTemplate) => void;
}

export function TemplateDialog({ open, onOpenChange, templates, error, onUse }: TemplateDialogProps) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<TriggerSource | 'ALL'>('ALL');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (templates ?? []).filter((t) => {
      if (source !== 'ALL' && !t.triggers.some((tr) => tr.source === source)) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [templates, query, source]);

  const filterButton = (value: TriggerSource | 'ALL', label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setSource(value)}
      aria-pressed={source === value}
      className={`rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors ${
        source === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(46rem,90dvh)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-6 py-4 pr-16">
          <div>
            <DialogTitle className="text-lg">Templates</DialogTitle>
            <DialogDescription className="sr-only">Pick a template or start from scratch</DialogDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <Plus size={14} />
            Start from scratch
          </Button>
        </DialogHeader>

        <div className="border-b border-border px-6 py-4">
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Instagram templates..."
              aria-label="Search templates"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Template filters" className="flex flex-row gap-1 overflow-x-auto border-b border-border p-4 md:flex-col md:border-b-0 md:border-r">
            {filterButton('ALL', 'All templates')}
            <p className="hidden px-3 pb-1 pt-4 text-xs font-medium text-muted-foreground md:block">By trigger</p>
            {SOURCE_FILTERS.map((f) => filterButton(f.value, f.label))}
          </nav>

          <div className="min-h-0 overflow-y-auto p-6">
            {error && (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load templates ({error}). You can still start from scratch.
              </p>
            )}
            {!error && templates === null && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-44 animate-pulse rounded-[var(--radius-card)] border border-border bg-muted" />
                ))}
              </div>
            )}
            {templates && visible.length === 0 && (
              <p className="text-sm text-muted-foreground">No templates match your search.</p>
            )}
            {visible.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((template) => {
                  const sources = Array.from(new Set(template.triggers.map((t) => t.source)));
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onUse(template)}
                      className="flex min-h-44 flex-col rounded-[var(--radius-card)] border border-border bg-background p-5 text-left transition-colors hover:border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      <h3 className="text-base font-semibold leading-snug text-foreground">{template.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                      <span className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-muted-foreground">
                        <Lightning size={13} />
                        {sources.map((s) => (
                          <Badge key={s}>{SOURCE_LABELS[s]}</Badge>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
