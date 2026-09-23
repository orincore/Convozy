'use client';

import { useRef, useState } from 'react';
import {
  ArrowBendDownRight,
  CircleNotch,
  EyeSlash,
  File as FileIcon,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  LockSimple,
  Paperclip,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ApiError,
  mediaApi,
  type ActionButtonKind,
  type ActionInput,
  type ActionType,
  type AutomationAction,
  type ConditionField,
  type CustomField,
  type MediaKind,
  type TriggerMatchType,
} from '@/lib/api';

const ACCEPTED_MEDIA_TYPES =
  'image/png,image/jpeg,image/gif,video/mp4,video/ogg,video/webm,video/quicktime,video/x-msvideo,audio/aac,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/mpeg,application/pdf';

const MEDIA_ICON: Record<MediaKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  file: FileIcon,
};

// Mirrors AutomationsService.MAX_ACTION_TREE_DEPTH on the backend (see
// automations.service.ts) — kept in sync manually since there's no shared
// constants package between apps/api and apps/web yet.
const MAX_ACTION_TREE_DEPTH = 5;

// The two built-in merge tags every message/reply field supports, mirroring
// AutomationsService.renderMergeTags on the backend. Workspace custom
// fields (contacts module) are appended per-instance as {{field.<key>}} —
// see buildMergeFieldOptions below.
const BUILTIN_MERGE_FIELDS: { tag: string; label: string }[] = [
  { tag: 'username', label: 'Username' },
  { tag: 'full_name', label: 'Full name' },
];

interface MergeFieldOption {
  tag: string;
  label: string;
}

function buildMergeFieldOptions(customFields: CustomField[]): MergeFieldOption[] {
  return [...BUILTIN_MERGE_FIELDS, ...customFields.map((f) => ({ tag: `field.${f.key}`, label: f.label }))];
}

// Inserts {{tag}} at the caret position of the textarea identified by
// `elementId` (looked up by DOM id rather than a React ref, since every
// call site here renders inside an array .map() where hooks can't be
// called) and updates the field's controlled value through `onChange`.
// Falls back to appending at the end if the element can't be found (e.g.
// autofill/SSR edge cases).
function insertMergeTag(elementId: string, value: string, onChange: (next: string) => void, tag: string): void {
  const token = `{{${tag}}}`;
  const el = typeof document !== 'undefined' ? (document.getElementById(elementId) as HTMLTextAreaElement | null) : null;
  if (!el) {
    onChange(value + token);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  onChange(value.slice(0, start) + token + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}

function MergeTagBar({ options, onInsert }: { options: MergeFieldOption[]; onInsert: (tag: string) => void }) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.tag}
          type="button"
          onClick={() => onInsert(opt.tag)}
          className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
        >
          + {opt.label}
        </button>
      ))}
    </div>
  );
}

const STEP_TYPES: { value: ActionType; label: string; hint: string }[] = [
  { value: 'SEND_DM', label: 'Send a DM', hint: 'Private reply / message' },
  { value: 'REPLY_COMMENT', label: 'Reply publicly', hint: 'Public reply under the comment (comments only)' },
  { value: 'HIDE_COMMENT', label: 'Hide comment', hint: 'Hide the triggering comment (comments only, no message sent)' },
  { value: 'CONDITION', label: 'If / else', hint: 'Branch based on the comment text or sender' },
];

// Types that carry no message payload of their own — mirrors ActionDto's
// @ValidateIf on the backend (CONDITION and HIDE_COMMENT both skip payload).
const NO_PAYLOAD_TYPES: ActionType[] = ['CONDITION', 'HIDE_COMMENT'];

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'COMMENT_TEXT', label: 'Comment text' },
  { value: 'SENDER_USERNAME', label: 'Sender username' },
];

const CONDITION_MATCH_TYPES: { value: TriggerMatchType; label: string; hint: string }[] = [
  { value: 'CONTAINS', label: 'Contains', hint: 'True if the field includes any keyword — leave blank to always be true' },
  { value: 'EXACT', label: 'Exact match', hint: 'True only if the field is exactly one keyword — leave blank to always be true' },
  { value: 'REGEX', label: 'Regex', hint: 'First keyword is used as a regular expression' },
];

// A button on a SEND_DM step, edited locally. Mirrors ActionButtonInput —
// `payload` (the postback identifier) is never set here, it's assigned
// server-side once the action row exists (see the backend's createActionTree).
export interface ButtonNode {
  id: string;
  title: string;
  type: ActionButtonKind;
  url: string;
  requireFollow: boolean;
  unlockedText: string;
  unlockedMedia: MediaNode | null;
  lockedText: string;
  lockedMedia: MediaNode | null;
}

// A media attachment picked in the builder. Mutually exclusive with
// `buttons` on the same step — Meta sends these as different message
// shapes (see ActionMediaInput on the backend/lib/api.ts side).
export interface MediaNode {
  type: MediaKind;
  url: string;
  filename: string;
  sizeBytes: number;
}

// The local editor's tree node — a flat shape covering both message actions
// and CONDITION actions (same house convention as the existing ActionRow:
// every field present regardless of type, only the relevant ones read at
// submit time). `id` is a client-only key for tree operations/React keys,
// never sent to the API.
export interface ActionStepNode {
  id: string;
  type: ActionType;
  text: string;
  delaySeconds: string;
  buttons: ButtonNode[];
  media: MediaNode | null;
  conditionField: ConditionField;
  conditionMatchType: TriggerMatchType;
  conditionKeywords: string;
  conditionCaseSensitive: boolean;
  then: ActionStepNode[];
  else: ActionStepNode[];
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `step-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function emptyButton(): ButtonNode {
  return {
    id: makeId(),
    title: '',
    type: 'WEB_URL',
    url: '',
    requireFollow: false,
    unlockedText: '',
    unlockedMedia: null,
    lockedText: '',
    lockedMedia: null,
  };
}

export function emptyActionStep(type: ActionType = 'SEND_DM'): ActionStepNode {
  return {
    id: makeId(),
    type,
    text: '',
    delaySeconds: '0',
    buttons: [],
    media: null,
    conditionField: 'COMMENT_TEXT',
    conditionMatchType: 'CONTAINS',
    conditionKeywords: '',
    conditionCaseSensitive: false,
    then: [],
    else: [],
  };
}

function mapTree(nodes: ActionStepNode[], id: string, fn: (n: ActionStepNode) => ActionStepNode): ActionStepNode[] {
  return nodes.map((n) => (n.id === id ? fn(n) : { ...n, then: mapTree(n.then, id, fn), else: mapTree(n.else, id, fn) }));
}

export function updateActionStep(nodes: ActionStepNode[], id: string, patch: Partial<ActionStepNode>): ActionStepNode[] {
  return mapTree(nodes, id, (n) => ({ ...n, ...patch }));
}

export function removeActionStep(nodes: ActionStepNode[], id: string): ActionStepNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, then: removeActionStep(n.then, id), else: removeActionStep(n.else, id) }));
}

export function addActionStep(
  nodes: ActionStepNode[],
  parentId: string | null,
  branch: 'then' | 'else' | null,
  node: ActionStepNode,
): ActionStepNode[] {
  if (parentId === null) {
    return [...nodes, node];
  }
  return nodes.map((n) => {
    if (n.id === parentId && branch) {
      return { ...n, [branch]: [...n[branch], node] };
    }
    return {
      ...n,
      then: addActionStep(n.then, parentId, branch, node),
      else: addActionStep(n.else, parentId, branch, node),
    };
  });
}

/** Recursively serializes the editor's local tree into the API's ActionInput shape. */
export function serializeActionSteps(nodes: ActionStepNode[]): ActionInput[] {
  return nodes.map((n, index) => {
    if (n.type === 'CONDITION') {
      return {
        type: n.type,
        order: index,
        condition: {
          matchType: n.conditionMatchType,
          field: n.conditionField,
          keywords: n.conditionKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          caseSensitive: n.conditionCaseSensitive,
        },
        children: {
          then: serializeActionSteps(n.then),
          else: serializeActionSteps(n.else),
        },
      };
    }
    if (n.type === 'HIDE_COMMENT') {
      return {
        type: n.type,
        order: index,
        delaySeconds: Number(n.delaySeconds) || 0,
      };
    }
    return {
      type: n.type,
      order: index,
      delaySeconds: Number(n.delaySeconds) || 0,
      payload: {
        // A media-only message has no caption field on Meta's side — omit
        // text entirely rather than send an empty string when attached.
        text: n.media ? undefined : n.text.trim(),
        buttons: n.media
          ? undefined
          : n.buttons.length
            ? n.buttons.map((b) =>
                b.type === 'POSTBACK'
                  ? {
                      title: b.title.trim(),
                      type: b.type,
                      requireFollow: b.requireFollow,
                      // Text and media are mutually exclusive per reply —
                      // mirrors payload.text/payload.media above.
                      unlockedText: b.unlockedMedia ? undefined : b.unlockedText.trim(),
                      unlockedMedia: b.unlockedMedia ? { type: b.unlockedMedia.type, url: b.unlockedMedia.url } : undefined,
                      lockedText: b.requireFollow && !b.lockedMedia ? b.lockedText.trim() : undefined,
                      lockedMedia:
                        b.requireFollow && b.lockedMedia ? { type: b.lockedMedia.type, url: b.lockedMedia.url } : undefined,
                    }
                  : { title: b.title.trim(), type: b.type, url: b.url.trim() },
              )
            : undefined,
        media: n.media ? { type: n.media.type, url: n.media.url } : undefined,
      },
    };
  });
}

// Only `type`/`url` are persisted server-side (ActionMediaDto) —
// filename/size are upload-time-only presentation details, so a loaded
// attachment's preview derives a filename from the URL and shows no size.
function toMediaNode(media: { type: MediaKind; url: string } | undefined | null): MediaNode | null {
  return media ? { type: media.type, url: media.url, filename: media.url.split('/').pop() ?? 'file', sizeBytes: 0 } : null;
}

/**
 * Inverse of serializeActionSteps — turns a persisted automation's action
 * tree (as returned by the API, branch-tagged children mixed in one array)
 * back into the editor's local tree shape, for the edit page to prefill.
 * `order` is already applied server-side (ACTIONS_INCLUDE sorts by it), and
 * `.filter()` preserves that order, so THEN/ELSE branches come out sorted.
 */
export function deserializeActionSteps(actions: AutomationAction[]): ActionStepNode[] {
  return actions.map((action) => {
    if (action.type === 'CONDITION' && action.condition) {
      return {
        id: action.id,
        type: 'CONDITION',
        text: '',
        delaySeconds: '0',
        buttons: [],
        media: null,
        conditionField: action.condition.field ?? 'COMMENT_TEXT',
        conditionMatchType: action.condition.matchType,
        conditionKeywords: action.condition.keywords.join(', '),
        conditionCaseSensitive: action.condition.caseSensitive ?? false,
        then: deserializeActionSteps(action.children.filter((c) => c.branch === 'THEN')),
        else: deserializeActionSteps(action.children.filter((c) => c.branch === 'ELSE')),
      };
    }
    return {
      id: action.id,
      type: action.type,
      text: action.payload?.text ?? '',
      delaySeconds: String(action.delaySeconds ?? 0),
      buttons: (action.payload?.buttons ?? []).map((b) => ({
        id: makeId(),
        title: b.title,
        type: b.type,
        url: b.url ?? '',
        requireFollow: b.requireFollow ?? false,
        unlockedText: b.unlockedText ?? '',
        unlockedMedia: toMediaNode(b.unlockedMedia),
        lockedText: b.lockedText ?? '',
        lockedMedia: toMediaNode(b.lockedMedia),
      })),
      media: toMediaNode(action.payload?.media),
      conditionField: 'COMMENT_TEXT',
      conditionMatchType: 'CONTAINS',
      conditionKeywords: '',
      conditionCaseSensitive: false,
      then: [],
      else: [],
    };
  });
}

/**
 * Client-side mirror of AutomationsService.validateActionTree — same rules,
 * so the form can surface a specific error before the API round-trip would
 * reject it. depth 1 = the root list (matches the backend's own numbering).
 */
export function validateActionSteps(nodes: ActionStepNode[], depth = 1): string | null {
  if (depth > MAX_ACTION_TREE_DEPTH) {
    return `Condition branches can nest at most ${MAX_ACTION_TREE_DEPTH} levels deep.`;
  }
  for (const node of nodes) {
    if (node.type === 'CONDITION') {
      // Only REGEX needs a keyword (the pattern) — CONTAINS/EXACT with no
      // keyword is a deliberate always-true condition, not an error.
      if (node.conditionMatchType === 'REGEX') {
        const pattern = node.conditionKeywords.split(',')[0]?.trim();
        if (!pattern) {
          return 'Regex conditions need a pattern.';
        }
        try {
          new RegExp(pattern);
        } catch {
          return 'One of your conditions has an invalid regular expression.';
        }
      }
      const thenError = validateActionSteps(node.then, depth + 1);
      if (thenError) return thenError;
      const elseError = validateActionSteps(node.else, depth + 1);
      if (elseError) return elseError;
    } else if (!NO_PAYLOAD_TYPES.includes(node.type) && !node.media && node.text.trim() === '') {
      return 'Every action needs a message.';
    } else if (node.type !== 'SEND_DM' && node.media) {
      return 'Media attachments are only available on "Send a DM" steps.';
    } else if (node.media && node.buttons.length > 0) {
      return 'A message can have buttons or a media attachment, not both.';
    } else if (node.buttons.length > 0) {
      if (node.buttons.length > 3) {
        return 'A message can have at most 3 buttons.';
      }
      for (const button of node.buttons) {
        if (!button.title.trim()) {
          return 'Every button needs a title.';
        }
        if (button.type === 'WEB_URL' && !button.url.trim()) {
          return `"${button.title}" needs a link.`;
        }
        if (button.type === 'POSTBACK') {
          const hasUnlocked = button.unlockedText.trim() || button.unlockedMedia;
          if (button.unlockedText.trim() && button.unlockedMedia) {
            return `"${button.title}"'s reply can be text or a media attachment, not both.`;
          }
          if (!hasUnlocked) {
            return `"${button.title}" needs a reply (text or media) to send when tapped.`;
          }
          if (button.requireFollow) {
            const hasLocked = button.lockedText.trim() || button.lockedMedia;
            if (button.lockedText.trim() && button.lockedMedia) {
              return `"${button.title}"'s locked reply can be text or a media attachment, not both.`;
            }
            if (!hasLocked) {
              return `"${button.title}" requires a follow, so it also needs a reply for people who aren't following yet.`;
            }
          }
        }
      }
    }
  }
  return null;
}

interface ActionStepEditorProps {
  nodes: ActionStepNode[];
  depth: number;
  minItems: number;
  parentId: string | null;
  branch: 'then' | 'else' | null;
  storyReplyWarning: boolean;
  // Workspace custom fields (contacts module), offered as {{field.<key>}}
  // merge tags alongside the built-in {{username}}/{{full_name}} — fetched
  // once by the page that mounts this editor, not by this component, so
  // it's not re-fetched on every recursion into a CONDITION's branches.
  customFields: CustomField[];
  onUpdate: (id: string, patch: Partial<ActionStepNode>) => void;
  onRemove: (id: string) => void;
  onAdd: (parentId: string | null, branch: 'then' | 'else' | null, type: ActionType) => void;
}

/**
 * Renders one level of the action/condition tree and recurses into a
 * CONDITION node's THEN/ELSE branches. The top-level page owns the actual
 * tree state and passes bound onUpdate/onRemove/onAdd callbacks down — this
 * component never mutates the tree itself, it only reports the id/branch
 * the change applies to (same "report intent, parent owns state" shape as
 * the rest of this codebase's forms).
 */
export function ActionStepEditor({
  nodes,
  depth,
  minItems,
  parentId,
  branch,
  storyReplyWarning,
  customFields,
  onUpdate,
  onRemove,
  onAdd,
}: ActionStepEditorProps) {
  const canAddCondition = depth < MAX_ACTION_TREE_DEPTH;
  const mergeFieldOptions = buildMergeFieldOptions(customFields);

  return (
    <div className="flex flex-col gap-3">
      {nodes.map((node) => (
        <div key={node.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`step-type-${node.id}`} className="text-xs text-muted-foreground">
                  Step
                </Label>
                <Select
                  id={`step-type-${node.id}`}
                  value={node.type}
                  onChange={(e) => onUpdate(node.id, { type: e.target.value as ActionType })}
                >
                  {STEP_TYPES.filter((s) => s.value !== 'CONDITION' || canAddCondition || node.type === 'CONDITION').map(
                    (s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ),
                  )}
                </Select>
              </div>
              {node.type !== 'CONDITION' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`step-delay-${node.id}`} className="text-xs text-muted-foreground">
                    Delay (seconds)
                  </Label>
                  <Input
                    id={`step-delay-${node.id}`}
                    type="number"
                    min={0}
                    value={node.delaySeconds}
                    onChange={(e) => onUpdate(node.id, { delaySeconds: e.target.value })}
                  />
                </div>
              )}
            </div>
            {(nodes.length > minItems || parentId !== null) && (
              <button
                type="button"
                onClick={() => onRemove(node.id)}
                className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                aria-label="Remove step"
              >
                <Trash size={14} />
              </button>
            )}
          </div>

          {node.type === 'CONDITION' ? (
            <>
              <div className="grid grid-cols-3 gap-3 rounded-[var(--radius-control)] border border-border bg-background p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`cond-field-${node.id}`} className="text-xs text-muted-foreground">
                    Check
                  </Label>
                  <Select
                    id={`cond-field-${node.id}`}
                    value={node.conditionField}
                    onChange={(e) => onUpdate(node.id, { conditionField: e.target.value as ConditionField })}
                  >
                    {CONDITION_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`cond-match-${node.id}`} className="text-xs text-muted-foreground">
                    Condition
                  </Label>
                  <Select
                    id={`cond-match-${node.id}`}
                    value={node.conditionMatchType}
                    onChange={(e) => onUpdate(node.id, { conditionMatchType: e.target.value as TriggerMatchType })}
                  >
                    {CONDITION_MATCH_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`cond-keywords-${node.id}`} className="text-xs text-muted-foreground">
                    Keywords
                  </Label>
                  <Input
                    id={`cond-keywords-${node.id}`}
                    value={node.conditionKeywords}
                    onChange={(e) => onUpdate(node.id, { conditionKeywords: e.target.value })}
                    placeholder="vip, priority"
                  />
                </div>
                <p className="col-span-3 text-xs text-muted-foreground">
                  {CONDITION_MATCH_TYPES.find((m) => m.value === node.conditionMatchType)?.hint}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="solid">Then</Badge>
                    <span className="text-xs text-muted-foreground">If the condition matches</span>
                  </div>
                  <ActionStepEditor
                    nodes={node.then}
                    depth={depth + 1}
                    minItems={0}
                    parentId={node.id}
                    branch="then"
                    storyReplyWarning={storyReplyWarning}
                    customFields={customFields}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onAdd={onAdd}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdd(node.id, 'then', 'SEND_DM')}>
                      <Plus size={12} />
                      Action
                    </Button>
                    {depth + 1 < MAX_ACTION_TREE_DEPTH && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAdd(node.id, 'then', 'CONDITION')}
                      >
                        <ArrowBendDownRight size={12} />
                        Condition
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Else</Badge>
                    <span className="text-xs text-muted-foreground">Otherwise</span>
                  </div>
                  <ActionStepEditor
                    nodes={node.else}
                    depth={depth + 1}
                    minItems={0}
                    parentId={node.id}
                    branch="else"
                    storyReplyWarning={storyReplyWarning}
                    customFields={customFields}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onAdd={onAdd}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdd(node.id, 'else', 'SEND_DM')}>
                      <Plus size={12} />
                      Action
                    </Button>
                    {depth + 1 < MAX_ACTION_TREE_DEPTH && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAdd(node.id, 'else', 'CONDITION')}
                      >
                        <ArrowBendDownRight size={12} />
                        Condition
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : node.type === 'HIDE_COMMENT' ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <EyeSlash size={13} />
              Hides the comment that triggered this automation — no message is sent. Only applies to comment
              triggers; skipped for story replies and DMs.
            </p>
          ) : (
            <>
              {!node.media && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`step-text-${node.id}`} className="text-xs text-muted-foreground">
                    Message
                  </Label>
                  <MergeTagBar
                    options={mergeFieldOptions}
                    onInsert={(tag) => insertMergeTag(`step-text-${node.id}`, node.text, (v) => onUpdate(node.id, { text: v }), tag)}
                  />
                  <textarea
                    id={`step-text-${node.id}`}
                    value={node.text}
                    onChange={(e) => onUpdate(node.id, { text: e.target.value })}
                    rows={3}
                    placeholder="Hey {{username}}, here's the link!"
                    className="w-full resize-none rounded-[var(--radius-control)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tap a tag above to insert it, or type it directly.
                    {storyReplyWarning &&
                      ' For story replies {{username}} will show a numeric ID, not a handle — Instagram’s webhook doesn’t include one for those.'}
                  </p>
                </div>
              )}

              {node.type === 'SEND_DM' && (
                <>
                  {!node.media && (
                    <ButtonListEditor node={node} mergeFieldOptions={mergeFieldOptions} onUpdate={(patch) => onUpdate(node.id, patch)} />
                  )}
                  {node.buttons.length === 0 && (
                    <MediaAttachmentEditor
                      media={node.media}
                      onAttach={(media) => onUpdate(node.id, { media, text: '' })}
                      onRemove={() => onUpdate(node.id, { media: null })}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ButtonListEditor({
  node,
  mergeFieldOptions,
  onUpdate,
}: {
  node: ActionStepNode;
  mergeFieldOptions: MergeFieldOption[];
  onUpdate: (patch: Partial<ActionStepNode>) => void;
}) {
  function updateButton(buttonId: string, patch: Partial<ButtonNode>) {
    onUpdate({ buttons: node.buttons.map((b) => (b.id === buttonId ? { ...b, ...patch } : b)) });
  }
  function removeButton(buttonId: string) {
    onUpdate({ buttons: node.buttons.filter((b) => b.id !== buttonId) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Buttons (optional, up to 3)</Label>
        {node.buttons.length < 3 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdate({ buttons: [...node.buttons, emptyButton()] })}
          >
            <Plus size={12} />
            Add button
          </Button>
        )}
      </div>

      {node.buttons.map((button) => (
        <div key={button.id} className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-background p-3">
          <div className="flex items-start gap-3">
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`btn-title-${button.id}`} className="text-xs text-muted-foreground">
                  Button label
                </Label>
                <Input
                  id={`btn-title-${button.id}`}
                  value={button.title}
                  onChange={(e) => updateButton(button.id, { title: e.target.value })}
                  placeholder="Get the link"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`btn-type-${button.id}`} className="text-xs text-muted-foreground">
                  Type
                </Label>
                <Select
                  id={`btn-type-${button.id}`}
                  value={button.type}
                  onChange={(e) => updateButton(button.id, { type: e.target.value as ActionButtonKind })}
                >
                  <option value="WEB_URL">Open a link</option>
                  <option value="POSTBACK">Send a reply when tapped</option>
                </Select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeButton(button.id)}
              className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
              aria-label={`Remove button ${button.title || ''}`}
            >
              <Trash size={14} />
            </button>
          </div>

          {button.type === 'WEB_URL' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`btn-url-${button.id}`} className="text-xs text-muted-foreground">
                Link
              </Label>
              <Input
                id={`btn-url-${button.id}`}
                value={button.url}
                onChange={(e) => updateButton(button.id, { url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={button.requireFollow}
                  onChange={(e) => updateButton(button.id, { requireFollow: e.target.checked })}
                  className="accent-accent"
                />
                <LockSimple size={13} />
                Require a follow before unlocking
              </label>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {button.requireFollow ? 'Reply when they already follow' : 'Reply sent when tapped'}
                </Label>
                {!button.unlockedMedia && (
                  <>
                    <MergeTagBar
                      options={mergeFieldOptions}
                      onInsert={(tag) =>
                        insertMergeTag(`btn-unlocked-${button.id}`, button.unlockedText, (v) => updateButton(button.id, { unlockedText: v }), tag)
                      }
                    />
                    <textarea
                      id={`btn-unlocked-${button.id}`}
                      value={button.unlockedText}
                      onChange={(e) => updateButton(button.id, { unlockedText: e.target.value })}
                      rows={2}
                      placeholder="Here's your link: ..."
                      className="w-full resize-none rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent"
                    />
                  </>
                )}
                <MediaAttachmentEditor
                  media={button.unlockedMedia}
                  onAttach={(media) => updateButton(button.id, { unlockedMedia: media, unlockedText: '' })}
                  onRemove={() => updateButton(button.id, { unlockedMedia: null })}
                />
              </div>

              {button.requireFollow && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Reply when they don&apos;t follow yet</Label>
                  {!button.lockedMedia && (
                    <>
                      <MergeTagBar
                        options={mergeFieldOptions}
                        onInsert={(tag) =>
                          insertMergeTag(`btn-locked-${button.id}`, button.lockedText, (v) => updateButton(button.id, { lockedText: v }), tag)
                        }
                      />
                      <textarea
                        id={`btn-locked-${button.id}`}
                        value={button.lockedText}
                        onChange={(e) => updateButton(button.id, { lockedText: e.target.value })}
                        rows={2}
                        placeholder="Follow me first, then tap the button again!"
                        className="w-full resize-none rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent"
                      />
                    </>
                  )}
                  <MediaAttachmentEditor
                    media={button.lockedMedia}
                    onAttach={(media) => updateButton(button.id, { lockedMedia: media, lockedText: '' })}
                    onRemove={() => updateButton(button.id, { lockedMedia: null })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Uploads a file to Convozy's own R2-backed /media/upload endpoint and
 * attaches the returned URL to this step. Mutually exclusive with buttons
 * (enforced by the parent only rendering this when node.buttons is empty,
 * and vice versa) — Meta sends a media attachment and a Button Template as
 * different message shapes, never combined.
 */
function MediaAttachmentEditor({
  media,
  onAttach,
  onRemove,
}: {
  media: MediaNode | null;
  onAttach: (media: MediaNode) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after removing it
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded = await mediaApi.upload(file);
      onAttach({ type: uploaded.type, url: uploaded.url, filename: uploaded.filename, sizeBytes: uploaded.sizeBytes });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload this file.');
    } finally {
      setUploading(false);
    }
  }

  if (media) {
    const Icon = MEDIA_ICON[media.type];
    const sizeLabel = formatBytes(media.sizeBytes);
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-background p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted">
            <Icon size={15} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{media.filename}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {media.type}
              {sizeLabel && ` · ${sizeLabel}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
          aria-label="Remove attachment"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input ref={inputRef} type="file" accept={ACCEPTED_MEDIA_TYPES} onChange={handleFileSelected} className="hidden" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <CircleNotch size={13} className="animate-spin" /> : <Paperclip size={13} />}
        {uploading ? 'Uploading…' : 'Attach a photo, video, audio, or PDF'}
      </Button>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <WarningCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}
