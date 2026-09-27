import { Injectable } from '@nestjs/common';
import { InstagramService } from '../instagram/instagram.service';
import { ContactsService } from './contacts.service';

// Instagram marks a glyph it can't represent in a profile name with a private-use
// character (e.g. U+F8FF), which then shows up as a stray symbol when the name is
// dropped into a message. Strip those and zero-width characters before sending.
function cleanProfileText(value: string): string {
  return value.replace(/[-​-‍﻿]/g, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Renders {{username}}, {{full_name}}, {{field.<key>}} merge tags against a
 * live sender profile — shared by automations and saved replies (tickets).
 * NOTE: AutomationsService has its own copy of this same logic
 * (`renderMergeTags`), predating this one — not consolidated onto this
 * service to avoid touching AutomationsService's constructor signature and
 * its large existing test suite. Worth unifying in a follow-up.
 */
@Injectable()
export class MergeTagsService {
  private static readonly MERGE_TAG_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

  constructor(
    private readonly instagramService: InstagramService,
    private readonly contactsService: ContactsService,
  ) {}

  async render(
    template: string,
    ctx: { workspaceId: string; instagramAccountId: string; igScopedId?: string | null; username?: string | null },
  ): Promise<string> {
    const tags = new Set<string>();
    for (const match of template.matchAll(MergeTagsService.MERGE_TAG_PATTERN)) {
      tags.add(match[1]);
    }
    if (tags.size === 0) {
      return template;
    }

    let username = ctx.username ?? undefined;
    let fullName: string | undefined;
    if (ctx.igScopedId && (tags.has('full_name') || (tags.has('username') && !username))) {
      const profile = await this.instagramService.fetchSenderProfile(ctx.instagramAccountId, ctx.igScopedId);
      fullName = profile.name ?? undefined;
      username = username ?? profile.username ?? undefined;
    }

    let fieldValues: Record<string, string> | undefined;
    if (ctx.igScopedId && [...tags].some((tag) => tag.startsWith('field.'))) {
      const contact = await this.contactsService.findByIgScopedId(ctx.workspaceId, ctx.instagramAccountId, ctx.igScopedId);
      fieldValues = {};
      for (const fv of contact?.fieldValues ?? []) {
        fieldValues[fv.customField.key] = fv.value;
      }
    }

    return template.replace(MergeTagsService.MERGE_TAG_PATTERN, (full, tag: string) => {
      if (tag === 'username') return cleanProfileText(username ?? '');
      if (tag === 'full_name') return cleanProfileText(fullName ?? '');
      if (tag.startsWith('field.')) return fieldValues?.[tag.slice('field.'.length)] ?? '';
      return full;
    });
  }
}
