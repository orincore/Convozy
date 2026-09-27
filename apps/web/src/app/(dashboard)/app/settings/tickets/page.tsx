'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, CircleNotch, PencilSimple, Plus, Trash, WarningCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, SavedReply, TicketSettings, savedRepliesApi, ticketsApi } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

const TOGGLES: { key: keyof Omit<TicketSettings, 'keywords' | 'enabled'>; title: string; hint: string }[] = [
  {
    key: 'autoAssignEnabled',
    title: 'Auto-assign new tickets',
    hint: 'Each new ticket goes to whoever on the team currently has the fewest open tickets, instead of sitting unassigned. A ticket must be assigned before anyone can DM through it, so this saves a manual step.',
  },
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

      <SavedRepliesSection />
    </div>
  );
}

function SavedRepliesSection() {
  const [replies, setReplies] = useState<SavedReply[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    savedRepliesApi.list().then(setReplies).catch((err: ApiError) => setError(err.message));
  }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const reply = await savedRepliesApi.create({ title: title.trim(), text: text.trim() });
      setReplies((current) => [...(current ?? []), reply].sort((a, b) => a.title.localeCompare(b.title)));
      setTitle('');
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the saved reply');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(reply: SavedReply) {
    setEditingId(reply.id);
    setEditTitle(reply.title);
    setEditText(reply.text);
  }

  async function handleSaveEdit(id: string) {
    if (!editTitle.trim() || !editText.trim()) return;
    setSavingEditId(id);
    setError(null);
    try {
      const updated = await savedRepliesApi.update(id, { title: editTitle.trim(), text: editText.trim() });
      setReplies((current) => (current ?? []).map((r) => (r.id === id ? updated : r)).sort((a, b) => a.title.localeCompare(b.title)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes');
    } finally {
      setSavingEditId(null);
    }
  }

  async function handleDelete(reply: SavedReply) {
    if (!window.confirm(`Delete the "${reply.title}" saved reply? It will disappear from the composer's saved-replies picker.`)) return;
    setDeletingId(reply.id);
    const previous = replies;
    setReplies((current) => (current ?? []).filter((r) => r.id !== reply.id));
    try {
      await savedRepliesApi.remove(reply.id);
    } catch (err) {
      setReplies(previous);
      setError(err instanceof ApiError ? err.message : 'Could not delete the saved reply');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5 rounded-[var(--radius-card)] border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold">Saved replies</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Canned responses anyone on the team can drop into a ticket reply. Support the same{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{username}}'}</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{full_name}}'}</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{field.key}}'}</code> merge tags as automations.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-background p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reply-title">Title</Label>
          <Input id="reply-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shipping delay" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reply-text">Reply text</Label>
          <Textarea
            id="reply-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={`Hi {{username}}, thanks for your patience — your order is on its way!`}
            className="resize-none"
          />
        </div>
        <Button type="submit" size="sm" className="self-end" disabled={submitting || !title.trim() || !text.trim()}>
          {submitting ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={14} />}
          Add saved reply
        </Button>
      </form>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <WarningCircle size={16} />
          {error}
        </p>
      )}

      {replies === null && (
        <div className="flex justify-center py-8">
          <CircleNotch size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {replies && replies.length === 0 && <p className="text-sm text-muted-foreground">No saved replies yet — add one above.</p>}

      {replies && replies.length > 0 && (
        <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
          {replies.map((reply) =>
            editingId === reply.id ? (
              <li key={reply.id} className="flex flex-col gap-3 p-4">
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Title" />
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} maxLength={1000} aria-label="Reply text" className="resize-none" />
                <div className="flex items-center gap-2 self-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void handleSaveEdit(reply.id)} disabled={savingEditId === reply.id || !editTitle.trim() || !editText.trim()}>
                    {savingEditId === reply.id && <CircleNotch size={14} className="animate-spin" />}
                    Save
                  </Button>
                </div>
              </li>
            ) : (
              <li key={reply.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{reply.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{reply.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(reply)}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Edit ${reply.title}`}
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(reply)}
                    disabled={deletingId === reply.id}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50"
                    aria-label={`Delete ${reply.title}`}
                  >
                    {deletingId === reply.id ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
