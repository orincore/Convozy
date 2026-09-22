'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle, CircleNotch, ImageSquare, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ActionStepEditor,
  ActionStepNode,
  addActionStep,
  emptyActionStep,
  removeActionStep,
  serializeActionSteps,
  updateActionStep,
  validateActionSteps,
} from '@/components/automations/action-step-editor';
import {
  ApiError,
  ConnectedAccount,
  CreateAutomationInput,
  RecentMediaItem,
  instagramApi,
  automationsApi,
  TriggerSource,
  TriggerMatchType,
  AutomationScopeType,
} from '@/lib/api';

interface TriggerRow {
  source: TriggerSource;
  matchType: TriggerMatchType;
  keywords: string;
  caseSensitive: boolean;
}

const TRIGGER_SOURCES: { value: TriggerSource; label: string }[] = [
  { value: 'COMMENT', label: 'Comment' },
  { value: 'LIVE_COMMENT', label: 'Live comment' },
  { value: 'STORY_REPLY', label: 'Story reply' },
];

const MATCH_TYPES: { value: TriggerMatchType; label: string; hint: string }[] = [
  { value: 'CONTAINS', label: 'Contains', hint: 'Matches if the message includes any keyword' },
  { value: 'EXACT', label: 'Exact match', hint: 'Matches only if the message is exactly one keyword' },
  { value: 'REGEX', label: 'Regex', hint: 'First keyword is used as a regular expression' },
];

function emptyTrigger(): TriggerRow {
  return { source: 'COMMENT', matchType: 'CONTAINS', keywords: '', caseSensitive: false };
}

function MediaThumb({
  item,
  selected,
  onToggle,
}: {
  item: RecentMediaItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`group relative aspect-square overflow-hidden rounded-[var(--radius-control)] border transition-colors ${
        selected ? 'border-accent' : 'border-border hover:border-muted-foreground'
      }`}
    >
      {item.thumbnailUrl ? (
        <Image
          src={item.thumbnailUrl}
          alt={item.caption ?? 'Instagram post'}
          fill
          sizes="140px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <ImageSquare size={24} className="text-muted-foreground" />
        </div>
      )}
      <div
        className={`absolute inset-0 transition-colors ${selected ? 'bg-background/40' : 'bg-background/0 group-hover:bg-background/20'}`}
      />
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <CheckCircle size={14} weight="fill" />
        </span>
      )}
    </button>
  );
}

function PostPicker({
  accountId,
  scopeType,
  onScopeTypeChange,
  selectedMediaIds,
  onToggleMedia,
}: {
  accountId: string;
  scopeType: AutomationScopeType;
  onScopeTypeChange: (scope: AutomationScopeType) => void;
  selectedMediaIds: string[];
  onToggleMedia: (id: string) => void;
}) {
  const [media, setMedia] = useState<RecentMediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resetting local state before an async fetch triggered by a prop change
  // is the standard pattern here (same justified case as AuthGuard) — the
  // lint rule's general "don't setState synchronously in an effect" advice
  // is about avoiding cascading renders from state that mirrors other
  // state, not about clearing stale data before a fresh fetch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (scopeType !== 'SPECIFIC_POSTS' || !accountId) return;
    setMedia(null);
    setError(null);
    instagramApi
      .listMedia(accountId)
      .then(setMedia)
      .catch((err: ApiError) => setError(err.message));
  }, [accountId, scopeType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Applies to</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose which posts this automation watches.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-border p-3 has-[:checked]:border-accent">
          <input
            type="radio"
            name="scope"
            checked={scopeType === 'ALL_POSTS'}
            onChange={() => onScopeTypeChange('ALL_POSTS')}
            className="mt-0.5 accent-accent"
          />
          <span>
            <span className="block text-sm text-foreground">All posts</span>
            <span className="block text-xs text-muted-foreground">Watch every post and reel on this account</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-border p-3 has-[:checked]:border-accent">
          <input
            type="radio"
            name="scope"
            checked={scopeType === 'SPECIFIC_POSTS'}
            onChange={() => onScopeTypeChange('SPECIFIC_POSTS')}
            className="mt-0.5 accent-accent"
          />
          <span>
            <span className="block text-sm text-foreground">Specific posts</span>
            <span className="block text-xs text-muted-foreground">Pick which posts this rule watches</span>
          </span>
        </label>
      </div>

      {scopeType === 'SPECIFIC_POSTS' && (
        <div>
          {!accountId && <p className="text-xs text-muted-foreground">Pick an account first.</p>}
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <WarningCircle size={13} />
              {error}
            </p>
          )}
          {accountId && !error && media === null && (
            <div className="flex items-center justify-center py-8">
              <CircleNotch size={18} className="animate-spin text-muted-foreground" />
            </div>
          )}
          {media && media.length === 0 && (
            <p className="text-xs text-muted-foreground">No recent posts found on this account.</p>
          )}
          {media && media.length > 0 && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {selectedMediaIds.length} selected
              </p>
              <div className="grid grid-cols-3 gap-2">
                {media.map((item) => (
                  <MediaThumb
                    key={item.id}
                    item={item}
                    selected={selectedMediaIds.includes(item.id)}
                    onToggle={() => onToggleMedia(item.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewAutomationPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [triggers, setTriggers] = useState<TriggerRow[]>([emptyTrigger()]);
  const [actionSteps, setActionSteps] = useState<ActionStepNode[]>([emptyActionStep()]);
  const [scopeType, setScopeType] = useState<AutomationScopeType>('ALL_POSTS');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    instagramApi
      .listAccounts()
      .then((list) => {
        setAccounts(list);
        if (list.length > 0) setAccountId(list[0].id);
      })
      .catch((err: ApiError) => setError(err.message));
  }, []);

  function updateTrigger(index: number, patch: Partial<TriggerRow>) {
    setTriggers((current) => current.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function toggleMedia(id: string) {
    setSelectedMediaIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  }

  const includesStoryReply = triggers.some((t) => t.source === 'STORY_REPLY');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!accountId) {
      setError('Connect an Instagram account first.');
      return;
    }
    if (triggers.some((t) => t.keywords.trim() === '')) {
      setError('Every trigger needs at least one keyword.');
      return;
    }
    const actionStepsError = validateActionSteps(actionSteps);
    if (actionStepsError) {
      setError(actionStepsError);
      return;
    }
    if (scopeType === 'SPECIFIC_POSTS' && selectedMediaIds.length === 0) {
      setError('Pick at least one post, or switch to "All posts".');
      return;
    }
    if (
      scopeType === 'SPECIFIC_POSTS' &&
      triggers.some((t) => t.source === 'STORY_REPLY') &&
      triggers.length === triggers.filter((t) => t.source === 'STORY_REPLY').length
    ) {
      setError('Story replies aren’t tied to a specific post — switch to "All posts" or add a comment trigger too.');
      return;
    }

    const input: CreateAutomationInput = {
      name: name.trim() || 'Untitled automation',
      instagramAccountId: accountId,
      scopeType,
      scopeMediaIds: scopeType === 'SPECIFIC_POSTS' ? selectedMediaIds : undefined,
      triggers: triggers.map((t) => ({
        source: t.source,
        matchType: t.matchType,
        keywords: t.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        caseSensitive: t.caseSensitive,
      })),
      actions: serializeActionSteps(actionSteps),
    };

    setSubmitting(true);
    try {
      await automationsApi.create(input);
      router.push('/app/automations');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the automation');
      setSubmitting(false);
    }
  }

  if (accounts === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Connect an Instagram account before creating an automation.</p>
        <Button asChild size="sm">
          <Link href="/app">Connect Instagram</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/automations" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Automations
      </Link>

      <h1 className="mt-4 text-xl font-semibold">New automation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Comment or reply to a story with a keyword, get a reply automatically.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Send the price list"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="account">Instagram account</Label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setSelectedMediaIds([]);
                }}
                className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    @{account.igUsername}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">When this happens</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTriggers((current) => [...current, emptyTrigger()])}
              >
                <Plus size={14} />
                Add trigger
              </Button>
            </div>

            {triggers.map((trigger, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`source-${index}`} className="text-xs text-muted-foreground">
                        Source
                      </Label>
                      <select
                        id={`source-${index}`}
                        value={trigger.source}
                        onChange={(e) => updateTrigger(index, { source: e.target.value as TriggerSource })}
                        className="h-9 rounded-[var(--radius-control)] border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        {TRIGGER_SOURCES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`match-${index}`} className="text-xs text-muted-foreground">
                        Match type
                      </Label>
                      <select
                        id={`match-${index}`}
                        value={trigger.matchType}
                        onChange={(e) => updateTrigger(index, { matchType: e.target.value as TriggerMatchType })}
                        className="h-9 rounded-[var(--radius-control)] border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        {MATCH_TYPES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {triggers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTriggers((current) => current.filter((_, i) => i !== index))}
                      className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                      aria-label="Remove trigger"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`keywords-${index}`} className="text-xs text-muted-foreground">
                    Keywords (comma separated)
                  </Label>
                  <Input
                    id={`keywords-${index}`}
                    value={trigger.keywords}
                    onChange={(e) => updateTrigger(index, { keywords: e.target.value })}
                    placeholder="price, pricing, cost"
                  />
                  <p className="text-xs text-muted-foreground">
                    {MATCH_TYPES.find((m) => m.value === trigger.matchType)?.hint}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Then do this</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActionSteps((current) => addActionStep(current, null, null, emptyActionStep('SEND_DM')))}
                >
                  <Plus size={14} />
                  Add action
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setActionSteps((current) => addActionStep(current, null, null, emptyActionStep('CONDITION')))
                  }
                >
                  <Plus size={14} />
                  Add condition
                </Button>
              </div>
            </div>

            <ActionStepEditor
              nodes={actionSteps}
              depth={1}
              minItems={1}
              parentId={null}
              branch={null}
              storyReplyWarning={includesStoryReply}
              onUpdate={(id, patch) => setActionSteps((current) => updateActionStep(current, id, patch))}
              onRemove={(id) => setActionSteps((current) => removeActionStep(current, id))}
              onAdd={(parentId, branch, type) =>
                setActionSteps((current) => addActionStep(current, parentId, branch, emptyActionStep(type)))
              }
            />
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <WarningCircle size={16} weight="bold" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting && <CircleNotch size={16} className="animate-spin" />}
              Create automation
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/app/automations">Cancel</Link>
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <PostPicker
            accountId={accountId}
            scopeType={scopeType}
            onScopeTypeChange={(scope) => {
              setScopeType(scope);
              if (scope === 'ALL_POSTS') setSelectedMediaIds([]);
            }}
            selectedMediaIds={selectedMediaIds}
            onToggleMedia={toggleMedia}
          />
        </div>
      </form>
    </div>
  );
}
