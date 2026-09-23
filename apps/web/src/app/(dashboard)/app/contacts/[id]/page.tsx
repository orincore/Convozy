'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CircleNotch, Plus, WarningCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ApiError, Contact, CustomField, Tag, contactsApi, customFieldsApi, tagsApi } from '@/lib/api';

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contactId = params.id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allFields, setAllFields] = useState<CustomField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addTagId, setAddTagId] = useState('');
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);

  function load() {
    Promise.all([contactsApi.get(contactId), tagsApi.list(), customFieldsApi.list()])
      .then(([c, tags, fields]) => {
        setContact(c);
        setAllTags(tags);
        setAllFields(fields);
      })
      .catch((err: ApiError) => setError(err.message));
  }

  useEffect(load, [contactId]);

  const untaggedOptions = allTags.filter((t) => !contact?.tags.some((ct) => ct.tag.id === t.id));

  async function handleAddTag() {
    if (!addTagId) return;
    try {
      await contactsApi.addTag(contactId, addTagId);
      setAddTagId('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the tag');
    }
  }

  async function handleRemoveTag(tagId: string) {
    try {
      await contactsApi.removeTag(contactId, tagId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the tag');
    }
  }

  async function handleSaveField(field: CustomField) {
    const value = fieldDrafts[field.id];
    if (value === undefined) return;
    setSavingFieldId(field.id);
    setError(null);
    try {
      await contactsApi.setField(contactId, field.id, value);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the value');
    } finally {
      setSavingFieldId(null);
    }
  }

  if (!contact && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/contacts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Contacts
      </Link>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={16} weight="bold" />
          {error}
        </div>
      )}

      {contact && (
        <>
          <h1 className="mt-4 text-xl font-semibold">
            {contact.username ? `@${contact.username}` : contact.igScopedId}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last inbound {contact.lastInboundAt ? new Date(contact.lastInboundAt).toLocaleString() : 'never'}
          </p>

          <section className="mt-8 flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {contact.tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
              {contact.tags.map(({ tag }) => (
                <Badge key={tag.id} variant="outline" className="gap-1.5 pr-1.5">
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    aria-label={`Remove ${tag.name}`}
                    className="rounded-full p-0.5 hover:bg-muted"
                  >
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
            {untaggedOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={addTagId} onChange={(e) => setAddTagId(e.target.value)} className="h-9 flex-1">
                  <option value="">Add a tag…</option>
                  {untaggedOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={handleAddTag} disabled={!addTagId}>
                  <Plus size={14} />
                  Add
                </Button>
              </div>
            )}
          </section>

          <section className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Custom fields</h2>
            {allFields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No custom fields defined yet — create one on the{' '}
                <Link href="/app/custom-fields" className="text-foreground underline">
                  Custom fields
                </Link>{' '}
                page.
              </p>
            )}
            {allFields.map((field) => {
              const existing = contact.fieldValues.find((fv) => fv.customField.id === field.id);
              const draft = fieldDrafts[field.id] ?? existing?.value ?? '';
              return (
                <div key={field.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`field-${field.id}`} className="text-xs text-muted-foreground">
                      {field.label}
                    </Label>
                    <Input
                      id={`field-${field.id}`}
                      value={draft}
                      onChange={(e) => setFieldDrafts((cur) => ({ ...cur, [field.id]: e.target.value }))}
                      placeholder={field.type}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveField(field)}
                    disabled={savingFieldId === field.id || draft === (existing?.value ?? '')}
                  >
                    {savingFieldId === field.id && <CircleNotch size={14} className="animate-spin" />}
                    Save
                  </Button>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
