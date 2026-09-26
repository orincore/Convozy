'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, CircleNotch, Plus, WarningCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ApiError, TicketSettings, ticketsApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

const TOGGLES: { key: keyof Omit<TicketSettings, 'keywords' | 'enabled'>; title: string; hint: string }[] = [
  {
    key: 'createFromMentions',
    title: 'Comments that @mention your account',
    hint: 'A comment on your post that tags your handle opens a ticket. Several people on the same post share one ticket. Once that ticket is resolved, later complaints on the post are ignored.',
  },
  {
    key: 'createFromStoryMentions',
    title: 'Story mentions',
    hint: 'Someone mentions your account in their story. One ticket per person.',
  },
  {
    key: 'createFromTaggedPosts',
    title: 'Posts that tag your account',
    hint: 'Checked every 30 minutes. Read-only: Instagram gives no way to message or comment back on these.',
  },
  {
    key: 'createFromReferrals',
    title: 'ig.me link and ad clicks',
    hint: 'Someone starts a chat from one of your ig.me links or click-to-message ads.',
  },
  {
    key: 'createFromAllDms',
    title: 'Every new direct message',
    hint: 'Off: only messages containing a keyword, or from someone already on a ticket, open or join a ticket.',
  },
];

export default function TicketSettingsPage() {
  const [settings, setSettings] = useState<TicketSettings | null>(null);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const canEdit = ['OWNER', 'ADMIN'].includes(getCurrentUser()?.role ?? '');

  useEffect(() => {
    ticketsApi.getSettings().then(setSettings).catch((err: ApiError) => setError(err.message));
  }, []);

  function update(patch: Partial<TicketSettings>) {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    setSaved(false);
  }

  function addKeyword() {
    const k = keyword.trim();
    if (!k || !settings) return;
    if (!settings.keywords.some((x) => x.toLowerCase() === k.toLowerCase())) update({ keywords: [...settings.keywords, k] });
    setKeyword('');
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      setSettings(await ticketsApi.updateSettings(settings));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Tickets
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Ticket rules</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose what turns an Instagram interaction into a ticket for your team.</p>

      {!canEdit && <p className="mt-4 rounded-[var(--radius-control)] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Only owners and admins can change these rules.</p>}
      {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger"><WarningCircle size={16} />{error}</p>}
      {!settings && !error && <div className="mt-10 flex justify-center"><CircleNotch size={22} className="animate-spin text-muted-foreground" /></div>}

      {settings && (
        <div className="mt-6 flex flex-col gap-6 rounded-[var(--radius-card)] border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="tickets-enabled" className="text-base">Create tickets automatically</Label>
              <p className="mt-1 text-sm text-muted-foreground">Turn everything off in one place. Existing tickets stay.</p>
            </div>
            <Switch id="tickets-enabled" checked={settings.enabled} disabled={!canEdit} onCheckedChange={(v) => update({ enabled: v })} label="Create tickets automatically" />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="kw">Complaint keywords</Label>
            <p className="text-sm text-muted-foreground">A comment or message containing any of these opens a ticket, even without an @mention. Not case sensitive.</p>
            <div className="flex gap-2">
              <Input
                id="kw"
                value={keyword}
                disabled={!canEdit}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="refund, broken, scam, not working"
              />
              <Button type="button" variant="outline" disabled={!canEdit || !keyword.trim()} onClick={addKeyword}>
                <Plus size={14} />
                Add
              </Button>
            </div>
            {settings.keywords.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-2">
                {settings.keywords.map((k) => (
                  <li key={k} className="flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-3 pr-1.5 text-sm">
                    {k}
                    {canEdit && (
                      <button type="button" onClick={() => update({ keywords: settings.keywords.filter((x) => x !== k) })} className="rounded-full p-0.5 text-muted-foreground hover:text-danger" aria-label={`Remove ${k}`}>
                        <X size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <ul className="flex flex-col gap-5">
            {TOGGLES.map((t) => (
              <li key={t.key} className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor={t.key}>{t.title}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{t.hint}</p>
                </div>
                <Switch id={t.key} checked={settings[t.key]} disabled={!canEdit} onCheckedChange={(v) => update({ [t.key]: v })} label={t.title} />
              </li>
            ))}
          </ul>

          {canEdit && (
            <div className="flex items-center gap-3">
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <CircleNotch size={16} className="animate-spin" />}
                Save rules
              </Button>
              {saved && <span className="flex items-center gap-1.5 text-sm text-success"><CheckCircle size={16} weight="fill" />Saved</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
