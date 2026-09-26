'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CaretRight, CheckCircle, CircleNotch, ImageSquare, MagicWand, PencilSimple, Plus, Trash, WarningCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TemplateDialog } from '@/components/automations/template-dialog';
import { PhonePreview } from '@/components/automations/phone-preview';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ActionStepEditor,
  ActionStepNode,
  addActionStep,
  deserializeActionSteps,
  emptyActionStep,
  removeActionStep,
  serializeActionSteps,
  updateActionStep,
  validateActionSteps,
} from '@/components/automations/action-step-editor';
import {
  ApiError,
  Automation,
  AutomationTemplate,
  ConnectedAccount,
  CreateAutomationInput,
  CustomField,
  RecentMediaItem,
  instagramApi,
  automationsApi,
  customFieldsApi,
  templatesApi,
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
  { value: 'STORY_MENTION', label: 'Story mention' },
  { value: 'DM', label: 'Direct message' },
  { value: 'REFERRAL', label: 'ig.me link or ad click' },
];

// What the keyword field means for each source. Story mentions carry no text,
// so there is nothing to match on; referrals match the link's ?ref= value.
const SOURCE_KEYWORD_HINT: Partial<Record<TriggerSource, string>> = {
  STORY_MENTION: 'Someone mentions your account in their story. There is no text to match, so every mention triggers this.',
  REFERRAL: 'Matched against the ref value of your ig.me link (ig.me/yourname?ref=VALUE). Leave blank to match every link or ad click.',
  DM: 'Matched against the text of the message. A given person gets this automation at most once every 24 hours.',
};

const CONVERSATION_ONLY_SOURCES: TriggerSource[] = ['DM', 'STORY_REPLY', 'STORY_MENTION', 'REFERRAL'];

const MATCH_TYPES: { value: TriggerMatchType; label: string; hint: string }[] = [
  { value: 'CONTAINS', label: 'Contains', hint: 'Matches if the message includes any keyword — leave blank to match every comment' },
  { value: 'EXACT', label: 'Exact match', hint: 'Matches only if the message is exactly one keyword — leave blank to match every comment' },
  { value: 'REGEX', label: 'Regex', hint: 'First keyword is used as a regular expression' },
];

function emptyTrigger(): TriggerRow {
  return { source: 'COMMENT', matchType: 'CONTAINS', keywords: '', caseSensitive: false };
}

function automationToTriggerRows(triggers: Automation['triggers']): TriggerRow[] {
  return triggers.map((t) => ({
    source: t.source,
    matchType: t.matchType,
    keywords: t.keywords.join(', '),
    caseSensitive: t.caseSensitive ?? false,
  }));
}

const SOURCE_LABELS: Record<TriggerSource, string> = {
  COMMENT: 'Comment',
  DM: 'DM',
  STORY_REPLY: 'Story reply',
  LIVE_COMMENT: 'Live comment',
  STORY_MENTION: 'Story mention',
  REFERRAL: 'ig.me link / ad',
};

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

      <RadioGroup
        value={scopeType}
        onValueChange={(v) => onScopeTypeChange(v as AutomationScopeType)}
        className="gap-2"
      >
        {[
          { value: 'ALL_POSTS', title: 'All posts', hint: 'Watch every post and reel on this account' },
          { value: 'SPECIFIC_POSTS', title: 'Specific posts', hint: 'Pick which posts this rule watches' },
        ].map((opt) => (
          <label
            key={opt.value}
            htmlFor={`scope-${opt.value}`}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border p-3 transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-muted"
          >
            <RadioGroupItem id={`scope-${opt.value}`} value={opt.value} className="mt-0.5" />
            <span>
              <span className="block text-sm text-foreground">{opt.title}</span>
              <span className="block text-xs text-muted-foreground">{opt.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>

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

const STEP_LABELS: Record<string, string> = {
  SEND_DM: 'Send message',
  REPLY_COMMENT: 'Reply to comment',
  HIDE_COMMENT: 'Hide comment',
  CONDITION: 'If / else',
};

interface AutomationFormProps {
  accounts: ConnectedAccount[];
  /** Present = edit an existing automation; absent = create a new one. */
  automation?: Automation;
}

export function AutomationForm({ accounts, automation }: AutomationFormProps) {
  const router = useRouter();
  const isEdit = automation !== undefined;

  const [accountId, setAccountId] = useState(automation?.instagramAccountId ?? accounts[0]?.id ?? '');
  const [name, setName] = useState(automation?.name ?? '');
  const [triggers, setTriggers] = useState<TriggerRow[]>(
    automation ? automationToTriggerRows(automation.triggers) : [emptyTrigger()],
  );
  const [actionSteps, setActionSteps] = useState<ActionStepNode[]>(
    automation ? deserializeActionSteps(automation.actions) : [emptyActionStep()],
  );
  const [scopeType, setScopeType] = useState<AutomationScopeType>(automation?.scopeType ?? 'ALL_POSTS');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(automation?.scopeMediaIds ?? []);
  const [templatesOpen, setTemplatesOpen] = useState(!isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AutomationTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  // Offered as {{field.<key>}} merge tags in every message/reply field
  // (ActionStepEditor) — fetched once here rather than per-field so tapping
  // a tag chip doesn't wait on a network round trip. A fetch failure just
  // means no custom-field tags are offered (username/full_name still are);
  // it's not worth blocking or erroring the whole form over.
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    // Templates are a "start fresh" concept — irrelevant once editing an
    // existing automation, so skip the fetch entirely in edit mode.
    if (isEdit) return;
    templatesApi.list().then(setTemplates).catch((err: ApiError) => setTemplatesError(err.message));
  }, [isEdit]);

  useEffect(() => {
    customFieldsApi.list().then(setCustomFields).catch(() => setCustomFields([]));
  }, []);

  function applyTemplate(template: AutomationTemplate) {
    setName(template.name);
    setTriggers(
      template.triggers.map((t) => ({
        source: t.source,
        matchType: t.matchType,
        keywords: t.keywords.join(', '),
        caseSensitive: t.caseSensitive ?? false,
      })),
    );
    setActionSteps(
      template.actions.map((a) => ({
        ...emptyActionStep(a.type),
        text: a.payload?.text ?? '',
        delaySeconds: String(a.delaySeconds ?? 0),
      })),
    );
    setScopeType('ALL_POSTS');
    setSelectedMediaIds([]);
    setAppliedTemplateName(template.name);
    setTemplatesOpen(false);
    setError(null);
  }

  function clearTemplate() {
    setName('');
    setTriggers([emptyTrigger()]);
    setActionSteps([emptyActionStep()]);
    setAppliedTemplateName(null);
  }

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
    // Only REGEX needs a keyword — it's the pattern, there's no sensible
    // "match anything" fallback. EXACT/CONTAINS with no keyword is a
    // deliberate unconditional trigger (matches every comment).
    if (triggers.some((t) => t.matchType === 'REGEX' && t.keywords.trim() === '')) {
      setError('Regex triggers need a pattern.');
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
      triggers.every((t) => CONVERSATION_ONLY_SOURCES.includes(t.source))
    ) {
      setError('DMs, story replies, story mentions and link clicks aren’t tied to a specific post. Switch to "All posts" or add a comment trigger too.');
      return;
    }

    const triggerInputs = triggers.map((t) => ({
      source: t.source,
      matchType: t.matchType,
      keywords: t.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      caseSensitive: t.caseSensitive,
    }));
    const actionInputs = serializeActionSteps(actionSteps);

    setSubmitting(true);
    try {
      if (isEdit) {
        // instagramAccountId is deliberately not patchable — see
        // UpdateAutomationDto's own header comment on the backend.
        await automationsApi.update(automation.id, {
          name: name.trim() || 'Untitled automation',
          scopeType,
          scopeMediaIds: scopeType === 'SPECIFIC_POSTS' ? selectedMediaIds : [],
          triggers: triggerInputs,
          actions: actionInputs,
        });
      } else {
        const input: CreateAutomationInput = {
          name: name.trim() || 'Untitled automation',
          instagramAccountId: accountId,
          scopeType,
          scopeMediaIds: scopeType === 'SPECIFIC_POSTS' ? selectedMediaIds : undefined,
          triggers: triggerInputs,
          actions: actionInputs,
        };
        await automationsApi.create(input);
      }
      router.push('/app/automations');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${isEdit ? 'save' : 'create'} the automation`);
      setSubmitting(false);
    }
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

  const account = accounts.find((acc) => acc.id === accountId);
  function addTopLevelStep(type: 'SEND_DM' | 'CONDITION') {
    const node = emptyActionStep(type);
    setActionSteps((c) => addActionStep(c, null, null, node));
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <TemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        templates={templates}
        error={templatesError}
        onUse={applyTemplate}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            <Link href="/app/automations" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft size={14} />
              Automations
            </Link>
            <CaretRight size={12} className="text-muted-foreground" aria-hidden />
            <label htmlFor="name" className="sr-only">
              Automation name
            </label>
            <div className="relative flex min-w-0 items-center">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled"
                className="h-9 w-56 border-transparent bg-transparent pr-8 font-medium hover:border-border sm:w-72"
              />
              <PencilSimple size={14} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
            </div>
            {!isEdit && <Badge>Draft</Badge>}
          </nav>
          <div className="flex items-center gap-2">
            {!isEdit && (
              <Button type="button" variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
                <MagicWand size={14} />
                Templates
              </Button>
            )}
            <Button type="button" variant="outline" asChild>
              <Link href="/app/automations">Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <CircleNotch size={16} className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Create automation'}
            </Button>
          </div>
        </header>

        {appliedTemplateName && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-card px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <MagicWand size={15} />
              Prefilled from &ldquo;{appliedTemplateName}&rdquo;. Review and edit before creating.
            </span>
            <button
              type="button"
              onClick={clearTemplate}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <WarningCircle size={16} weight="bold" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 overflow-hidden rounded-[var(--radius-card)] border border-border xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Send message" className="min-w-0 bg-card xl:border-r xl:border-border">
            <div className="flex items-center justify-center border-b border-border bg-muted px-6 py-4">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Send message</h2>
            </div>

            <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 p-5 sm:p-6">
              <section aria-label="Trigger" className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Trigger</h3>
                  <div className="flex flex-col gap-2">
                  <Label htmlFor="account">Instagram account</Label>
                  <Select
                    id="account"
                    value={accountId}
                    disabled={isEdit || accounts.length === 1}
                    className="h-10 w-full"
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      setSelectedMediaIds([]);
                    }}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.igUsername}
                      </option>
                    ))}
                  </Select>
                  {isEdit && (
                    <p className="text-xs text-muted-foreground">
                      The account can&apos;t be changed after creation. Disconnect and recreate to move it.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Any one of these triggers starts the automation.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setTriggers((c) => [...c, emptyTrigger()])}>
                    <Plus size={14} />
                    Add trigger
                  </Button>
                </div>

                {triggers.map((trigger, index) => (
                  <div key={index} className="rounded-[var(--radius-control)] border border-dashed border-border p-4">
                    <div className={`grid grid-cols-1 gap-4 sm:items-end ${triggers.length > 1 ? 'sm:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-2'}`}>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`source-${index}`} className="text-xs text-muted-foreground">
                          Source
                        </Label>
                        <Select
                          id={`source-${index}`}
                          value={trigger.source}
                          className="h-10 w-full"
                          onChange={(e) => updateTrigger(index, { source: e.target.value as TriggerSource })}
                        >
                          {TRIGGER_SOURCES.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`match-${index}`} className="text-xs text-muted-foreground">
                          Match type
                        </Label>
                        <Select
                          id={`match-${index}`}
                          value={trigger.matchType}
                          className="h-10 w-full"
                          onChange={(e) => updateTrigger(index, { matchType: e.target.value as TriggerMatchType })}
                        >
                          {MATCH_TYPES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {triggers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTriggers((c) => c.filter((_, i) => i !== index))}
                          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                          aria-label="Remove trigger"
                        >
                          <Trash size={15} />
                        </button>
                      )}
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <Label htmlFor={`keywords-${index}`} className="text-xs text-muted-foreground">
                        Keywords, comma separated
                      </Label>
                      <Input
                        id={`keywords-${index}`}
                        value={trigger.keywords}
                        onChange={(e) => updateTrigger(index, { keywords: e.target.value })}
                        placeholder="price, pricing, cost"
                      />
                      <p className="text-xs text-muted-foreground">
                        {SOURCE_KEYWORD_HINT[trigger.source] ?? MATCH_TYPES.find((m) => m.value === trigger.matchType)?.hint}
                      </p>
                    </div>
                  </div>
                ))}
              </section>

              <Separator />

              <section aria-label="Message steps" className="flex flex-col gap-5">
                <h3 className="text-sm font-semibold text-foreground">Message</h3>
                {actionSteps.map((node, i) => (
                  <div key={node.id} className="flex flex-col gap-4">
                    {(actionSteps.length > 1 || node.type === 'CONDITION') && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          Step {i + 1}: {STEP_LABELS[node.type]}
                        </p>
                        {actionSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setActionSteps((c) => removeActionStep(c, node.id))}
                            className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-danger"
                          >
                            <Trash size={14} />
                            Delete step
                          </button>
                        )}
                      </div>
                    )}
                    <ActionStepEditor
                      nodes={[node]}
                      bare
                      depth={1}
                      minItems={1}
                      parentId={null}
                      branch={null}
                      storyReplyWarning={includesStoryReply}
                      customFields={customFields}
                      onUpdate={(id, patch) => setActionSteps((c) => updateActionStep(c, id, patch))}
                      onRemove={(id) => setActionSteps((c) => removeActionStep(c, id))}
                      onAdd={(parentId, branch, type) =>
                        setActionSteps((c) => addActionStep(c, parentId, branch, emptyActionStep(type)))
                      }
                    />
                    {i < actionSteps.length - 1 && <Separator />}
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addTopLevelStep('SEND_DM')}
                    className="flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                    Add another message
                  </button>
                  <button
                    type="button"
                    onClick={() => addTopLevelStep('CONDITION')}
                    className="flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                    Add if / else
                  </button>
                </div>
              </section>

              <Separator />

              <section aria-label="Applies to">
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
              </section>
            </div>
          </section>

          <aside aria-label="Message preview" className="border-t border-border bg-background p-4 xl:border-t-0">
            <PhonePreview
              accountName={account ? `@${account.igUsername}` : ''}
              displayName={account?.displayName}
              profilePictureUrl={account?.profilePictureUrl}
              steps={actionSteps}
            />
          </aside>
        </div>
      </form>
    </div>
  );
}
