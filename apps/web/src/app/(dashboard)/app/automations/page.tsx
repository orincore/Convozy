'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CircleNotch,
  WarningCircle,
  LightningSlash,
  PencilSimple,
  Plus,
  Trash,
  ChatCircleDots,
  PaperPlaneTilt,
  Sparkle,
  GitBranch,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { automationsApi, Automation, ApiError } from '@/lib/api';

const ACTION_ICON: Record<Automation['actions'][number]['type'], typeof ChatCircleDots> = {
  SEND_DM: PaperPlaneTilt,
  REPLY_COMMENT: ChatCircleDots,
  SEND_AI_REPLY: Sparkle,
  CONDITION: GitBranch,
};

function ActionSummary({ automation }: { automation: Automation }) {
  return (
    <div className="flex items-center gap-1.5">
      {automation.actions.map((action) => {
        const Icon = ACTION_ICON[action.type];
        return (
          <span
            key={action.id}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
            title={action.type}
          >
            <Icon size={13} weight="bold" />
          </span>
        );
      })}
    </div>
  );
}

function AutomationRow({
  automation,
  onToggle,
  onDelete,
  busy,
}: {
  automation: Automation;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const keywords = automation.triggers.flatMap((t) => t.keywords).slice(0, 3);

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{automation.name}</p>
          {automation.status === 'DRAFT' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
              Draft
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {automation.triggers[0]?.source === 'COMMENT' ? 'Comment' : automation.triggers[0]?.source ?? 'No trigger'}
          {keywords.length > 0 && <> · &ldquo;{keywords.join('", "')}&rdquo;</>}
          {automation.scopeType === 'SPECIFIC_POSTS' && ' · specific posts'}
        </p>
      </div>

      <div className="flex items-center gap-5">
        <ActionSummary automation={automation} />
        <Switch
          id={`toggle-${automation.id}`}
          label={`${automation.status === 'ACTIVE' ? 'Pause' : 'Activate'} ${automation.name}`}
          checked={automation.status === 'ACTIVE'}
          onCheckedChange={(checked) => onToggle(automation.id, checked)}
          disabled={busy}
        />
        <Link
          href={`/app/automations/${automation.id}/edit`}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Edit ${automation.name}`}
        >
          <PencilSimple size={16} />
        </Link>
        <button
          type="button"
          onClick={() => onDelete(automation.id)}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50"
          aria-label={`Delete ${automation.name}`}
        >
          <Trash size={16} />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
        <LightningSlash size={24} weight="bold" className="text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">No automations yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Create a rule that matches a comment keyword and sends a DM automatically.
        </p>
      </div>
      <Button asChild>
        <Link href="/app/automations/new">
          <Plus size={16} weight="bold" />
          Create automation
        </Link>
      </Button>
    </div>
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    automationsApi
      .list()
      .then(setAutomations)
      .catch((err: ApiError) => setError(err.message));
  }

  useEffect(load, []);

  async function handleToggle(id: string, active: boolean) {
    setBusyId(id);
    setError(null);
    const previous = automations;
    setAutomations((current) =>
      current?.map((a) => (a.id === id ? { ...a, status: active ? 'ACTIVE' : 'PAUSED' } : a)) ?? null,
    );
    try {
      await automationsApi.update(id, { status: active ? 'ACTIVE' : 'PAUSED' });
    } catch (err) {
      setAutomations(previous ?? null);
      setError(err instanceof ApiError ? err.message : 'Could not update the automation');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await automationsApi.remove(id);
      setAutomations((current) => current?.filter((a) => a.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the automation');
    } finally {
      setBusyId(null);
    }
  }

  if (automations === null && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && automations === null) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <WarningCircle size={24} className="text-danger" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (automations && automations.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Automations</h1>
        <Button asChild size="sm">
          <Link href="/app/automations/new">
            <Plus size={14} weight="bold" />
            New automation
          </Link>
        </Button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        {automations?.map((automation) => (
          <AutomationRow
            key={automation.id}
            automation={automation}
            onToggle={handleToggle}
            onDelete={handleDelete}
            busy={busyId === automation.id}
          />
        ))}
      </div>
    </div>
  );
}
