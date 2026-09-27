'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  WarningCircle,
  LightningSlash,
  PencilSimple,
  Plus,
  Trash,
  ChatCircleDots,
  EyeSlash,
  PaperPlaneTilt,
  Sparkle,
  GitBranch,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StatusPill, STATUS_PILL } from '@/components/dashboard/status-pill';
import { AutomationRowSkeleton } from '@/components/dashboard/skeleton';
import { Bezel } from '@/components/marketing/bezel';
import { SpotlightCard } from '@/components/marketing/spotlight-card';
import { CtaButton } from '@/components/marketing/cta-button';
import { automationsApi, Automation, ApiError } from '@/lib/api';

const ACTION_ICON: Record<Automation['actions'][number]['type'], typeof ChatCircleDots> = {
  SEND_DM: PaperPlaneTilt,
  REPLY_COMMENT: ChatCircleDots,
  SEND_AI_REPLY: Sparkle,
  CONDITION: GitBranch,
  HIDE_COMMENT: EyeSlash,
};

function ActionSummary({ automation }: { automation: Automation }) {
  return (
    <div className="flex items-center -space-x-1.5">
      {automation.actions.map((action) => {
        const Icon = ACTION_ICON[action.type];
        return (
          <span
            key={action.id}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card"
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
  const draftPill = STATUS_PILL.DRAFT;

  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{automation.name}</p>
          {automation.status === 'DRAFT' && (
            <StatusPill label={draftPill.label} tone={draftPill.tone} icon={draftPill.icon} />
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {automation.status === 'DRAFT'
            ? 'Not published yet'
            : automation.triggers[0]?.source === 'COMMENT'
              ? 'Comment'
              : automation.triggers[0]?.source ?? 'No trigger'}
          {keywords.length > 0 && <> · &ldquo;{keywords.join('", "')}&rdquo;</>}
          {automation.scopeType === 'SPECIFIC_POSTS' && ' · specific posts'}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
        <ActionSummary automation={automation} />
        {automation.status === 'DRAFT' ? (
          <Link
            href={`/app/automations/${automation.id}/edit`}
            className="rounded-[var(--radius-control)] border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Continue editing
          </Link>
        ) : (
          <Switch
            id={`toggle-${automation.id}`}
            label={`${automation.status === 'ACTIVE' ? 'Pause' : 'Activate'} ${automation.name}`}
            checked={automation.status === 'ACTIVE'}
            onCheckedChange={(checked) => onToggle(automation.id, checked)}
            disabled={busy}
          />
        )}
        <div className="flex items-center gap-1">
          <Link
            href={`/app/automations/${automation.id}/edit`}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Edit ${automation.name}`}
          >
            <PencilSimple size={16} />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${automation.name}"? It will stop sending immediately and this can't be undone.`)) {
                onDelete(automation.id);
              }
            }}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger active:scale-95 disabled:opacity-50"
            aria-label={`Delete ${automation.name}`}
          >
            <Trash size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex min-h-[55vh] flex-col items-center justify-center gap-6 text-center"
      initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-[-1.5rem] rounded-full bg-foreground/[0.06] blur-2xl" aria-hidden />
        <span className="absolute inset-0 rounded-full border border-foreground/10 bg-card" aria-hidden />
        <LightningSlash size={28} weight="bold" className="relative text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          No <span className="text-gradient">automations</span> yet
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">
          Create a rule that matches a comment keyword and sends a DM automatically.
        </p>
      </div>
      <CtaButton href="/app/automations/new">
        <Plus size={16} weight="bold" />
        Create automation
      </CtaButton>
    </motion.div>
  );
}

function AutomationsSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="block h-7 w-40 animate-pulse rounded-[var(--radius-control)] bg-muted motion-reduce:animate-none" />
        <span className="block h-9 w-32 animate-pulse rounded-[var(--radius-control)] bg-muted motion-reduce:animate-none" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Bezel key={i} className="rounded-[1.5rem]" coreClassName="rounded-[calc(1.5rem-0.375rem)]">
            <AutomationRowSkeleton />
          </Bezel>
        ))}
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reduce = useReducedMotion();

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
    return <AutomationsSkeleton />;
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          <span className="text-gradient">Automations</span>
        </h1>
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

      <div className="mt-6 flex flex-col gap-3">
        {automations?.map((automation, i) => (
          <motion.div
            key={automation.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <SpotlightCard className="rounded-[1.5rem]">
              <Bezel className="rounded-[1.5rem]" coreClassName="rounded-[calc(1.5rem-0.375rem)]">
                <AutomationRow
                  automation={automation}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  busy={busyId === automation.id}
                />
              </Bezel>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
