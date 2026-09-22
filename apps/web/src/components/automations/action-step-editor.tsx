'use client';

import { ArrowBendDownRight, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ActionInput, ActionType, ConditionField, TriggerMatchType } from '@/lib/api';

// Mirrors AutomationsService.MAX_ACTION_TREE_DEPTH on the backend (see
// automations.service.ts) — kept in sync manually since there's no shared
// constants package between apps/api and apps/web yet.
const MAX_ACTION_TREE_DEPTH = 5;

const STEP_TYPES: { value: ActionType; label: string; hint: string }[] = [
  { value: 'SEND_DM', label: 'Send a DM', hint: 'Private reply / message' },
  { value: 'REPLY_COMMENT', label: 'Reply publicly', hint: 'Public reply under the comment (comments only)' },
  { value: 'CONDITION', label: 'If / else', hint: 'Branch based on the comment text or sender' },
];

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'COMMENT_TEXT', label: 'Comment text' },
  { value: 'SENDER_USERNAME', label: 'Sender username' },
];

const CONDITION_MATCH_TYPES: { value: TriggerMatchType; label: string; hint: string }[] = [
  { value: 'CONTAINS', label: 'Contains', hint: 'True if the field includes any keyword — leave blank to always be true' },
  { value: 'EXACT', label: 'Exact match', hint: 'True only if the field is exactly one keyword — leave blank to always be true' },
  { value: 'REGEX', label: 'Regex', hint: 'First keyword is used as a regular expression' },
];

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

export function emptyActionStep(type: ActionType = 'SEND_DM'): ActionStepNode {
  return {
    id: makeId(),
    type,
    text: '',
    delaySeconds: '0',
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
    return {
      type: n.type,
      order: index,
      delaySeconds: Number(n.delaySeconds) || 0,
      payload: { text: n.text.trim() },
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
    } else if (node.text.trim() === '') {
      return 'Every action needs a message.';
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
  onUpdate,
  onRemove,
  onAdd,
}: ActionStepEditorProps) {
  const canAddCondition = depth < MAX_ACTION_TREE_DEPTH;

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
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`step-text-${node.id}`} className="text-xs text-muted-foreground">
                Message
              </Label>
              <textarea
                id={`step-text-${node.id}`}
                value={node.text}
                onChange={(e) => onUpdate(node.id, { text: e.target.value })}
                rows={3}
                placeholder="Hey {{username}}, here's the link!"
                className="w-full resize-none rounded-[var(--radius-control)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:border-accent"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{username}}'} to insert the sender&apos;s name.
                {storyReplyWarning &&
                  ' For story replies this will show a numeric ID, not a handle — Instagram’s webhook doesn’t include a username for those.'}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
