// segment-rule.dto.ts uses class-transformer @Type() decorators, which call
// Reflect.getMetadata at class-definition time — needs the polyfill loaded
// first, same as NestJS's own real bootstrap does.
import 'reflect-metadata';

jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    constructor(
      public response: unknown,
      public status: number,
    ) {
      super(typeof response === 'string' ? response : JSON.stringify(response));
    }
  }
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return {
    Injectable: () => () => {},
    Logger,
    HttpException,
    HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
  };
});

import { CustomFieldType } from '@prisma/client';
import { ContactsService } from './contacts.service';
import { AppException, NotFoundAppException } from '../../common/utils/app-exception';
import { SegmentRuleOp } from './dto/segment-rule.dto';

function makeService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    contact: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    tag: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    contactTag: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    customField: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    contactFieldValue: {
      upsert: jest.fn(),
    },
    segment: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    ...prismaOverrides,
  } as any;

  const service = new ContactsService(prisma);
  return { service, prisma };
}

describe('ContactsService.recordInbound', () => {
  it('upserts a Contact keyed by (workspace, account, igScopedId) and bumps lastInboundAt', async () => {
    const { service, prisma } = makeService();

    await service.recordInbound('workspace-1', 'account-1', 'ig-scoped-1', 'viewer123');

    expect(prisma.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_instagramAccountId_igScopedId: {
            workspaceId: 'workspace-1',
            instagramAccountId: 'account-1',
            igScopedId: 'ig-scoped-1',
          },
        },
        create: expect.objectContaining({ username: 'viewer123' }),
        update: expect.objectContaining({ username: 'viewer123' }),
      }),
    );
  });

  it('no-ops when igScopedId is missing (nothing stable to key a Contact on)', async () => {
    const { service, prisma } = makeService();

    await service.recordInbound('workspace-1', 'account-1', null);
    await service.recordInbound('workspace-1', 'account-1', undefined);

    expect(prisma.contact.upsert).not.toHaveBeenCalled();
  });
});

describe('ContactsService.findByIgScopedId', () => {
  it('looks up a Contact with its field values, keyed by workspace+account+igScopedId', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', fieldValues: [] });

    const result = await service.findByIgScopedId('workspace-1', 'account-1', 'ig-scoped-1');

    expect(result).toEqual({ id: 'contact-1', fieldValues: [] });
    expect(prisma.contact.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_instagramAccountId_igScopedId: {
            workspaceId: 'workspace-1',
            instagramAccountId: 'account-1',
            igScopedId: 'ig-scoped-1',
          },
        },
      }),
    );
  });

  it('returns null (not a throw) when no Contact exists yet', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue(null);

    await expect(service.findByIgScopedId('workspace-1', 'account-1', 'unknown')).resolves.toBeNull();
  });
});

describe('ContactsService tags', () => {
  it('adds a tag to a contact only after verifying both belong to the caller workspace', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', workspaceId: 'workspace-1' });

    await service.addTagToContact('workspace-1', 'contact-1', 'tag-1');

    expect(prisma.contactTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contactId_tagId: { contactId: 'contact-1', tagId: 'tag-1' } } }),
    );
  });

  it('404s adding a tag that belongs to a different workspace (CLAUDE.md §5a A01)', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', workspaceId: 'someone-elses-workspace' });

    await expect(service.addTagToContact('workspace-1', 'contact-1', 'tag-1')).rejects.toThrow(NotFoundAppException);
    expect(prisma.contactTag.upsert).not.toHaveBeenCalled();
  });

  it('404s adding a tag to a contact that belongs to a different workspace', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'someone-elses-workspace' });

    await expect(service.addTagToContact('workspace-1', 'contact-1', 'tag-1')).rejects.toThrow(NotFoundAppException);
  });

  it('404s deleting a tag owned by a different workspace', async () => {
    const { service, prisma } = makeService();
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', workspaceId: 'someone-elses-workspace' });

    await expect(service.deleteTag('workspace-1', 'tag-1')).rejects.toThrow(NotFoundAppException);
    expect(prisma.tag.delete).not.toHaveBeenCalled();
  });
});

describe('ContactsService custom fields', () => {
  it('accepts a valid NUMBER value', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.customField.findUnique.mockResolvedValue({ id: 'field-1', workspaceId: 'workspace-1', type: CustomFieldType.NUMBER });

    await service.setFieldValue('workspace-1', 'contact-1', 'field-1', '42');

    expect(prisma.contactFieldValue.upsert).toHaveBeenCalled();
  });

  it('rejects a non-numeric value for a NUMBER field', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.customField.findUnique.mockResolvedValue({ id: 'field-1', workspaceId: 'workspace-1', type: CustomFieldType.NUMBER });

    await expect(service.setFieldValue('workspace-1', 'contact-1', 'field-1', 'not-a-number')).rejects.toThrow(
      AppException,
    );
    expect(prisma.contactFieldValue.upsert).not.toHaveBeenCalled();
  });

  it('accepts "true"/"false" for a BOOLEAN field, rejects anything else', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.customField.findUnique.mockResolvedValue({ id: 'field-1', workspaceId: 'workspace-1', type: CustomFieldType.BOOLEAN });

    await service.setFieldValue('workspace-1', 'contact-1', 'field-1', 'true');
    expect(prisma.contactFieldValue.upsert).toHaveBeenCalledTimes(1);

    await expect(service.setFieldValue('workspace-1', 'contact-1', 'field-1', 'yes')).rejects.toThrow(AppException);
  });

  it('rejects an unparseable value for a DATE field', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.customField.findUnique.mockResolvedValue({ id: 'field-1', workspaceId: 'workspace-1', type: CustomFieldType.DATE });

    await expect(service.setFieldValue('workspace-1', 'contact-1', 'field-1', 'not-a-date')).rejects.toThrow(
      AppException,
    );
  });

  it('accepts any string for a TEXT field', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'workspace-1' });
    prisma.customField.findUnique.mockResolvedValue({ id: 'field-1', workspaceId: 'workspace-1', type: CustomFieldType.TEXT });

    await service.setFieldValue('workspace-1', 'contact-1', 'field-1', 'anything at all');

    expect(prisma.contactFieldValue.upsert).toHaveBeenCalled();
  });
});

describe('ContactsService contacts listing', () => {
  it('scopes every list to the caller workspace', async () => {
    const { service, prisma } = makeService();

    await service.listContacts('workspace-1', {});

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'workspace-1' }) }),
    );
  });

  it('filters by tagId when provided', async () => {
    const { service, prisma } = makeService();

    await service.listContacts('workspace-1', { tagId: 'tag-1' });

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tags: { some: { tagId: 'tag-1' } } }),
      }),
    );
  });

  it('404s findOne when the contact belongs to a different workspace', async () => {
    const { service, prisma } = makeService();
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', workspaceId: 'someone-elses-workspace' });

    await expect(service.getContact('workspace-1', 'contact-1')).rejects.toThrow(NotFoundAppException);
  });
});

describe('ContactsService segments — rule validation', () => {
  it('rejects a rule node with none of all/any/tag/field', async () => {
    const { service } = makeService();

    await expect(service.createSegment('workspace-1', { name: 'x', rules: {} as any })).rejects.toThrow(
      AppException,
    );
  });

  it('rejects a rule node with more than one of all/any/tag/field', async () => {
    const { service } = makeService();

    await expect(
      service.createSegment('workspace-1', { name: 'x', rules: { tag: 'vip', field: { key: 'a', op: SegmentRuleOp.EQ, value: '1' } } as any }),
    ).rejects.toThrow(AppException);
  });

  it('rejects a rule tree nested deeper than MAX_SEGMENT_RULE_DEPTH (5)', async () => {
    const { service } = makeService();
    let rule: any = { tag: 'vip' };
    for (let i = 0; i < 6; i++) {
      rule = { all: [rule] };
    }

    await expect(service.createSegment('workspace-1', { name: 'x', rules: rule })).rejects.toThrow(AppException);
  });

  it('accepts a valid nested all/any tree and persists the raw rules JSON', async () => {
    const { service, prisma } = makeService();
    prisma.segment.create.mockResolvedValue({ id: 'segment-1' });
    const rules = { all: [{ tag: 'vip' }, { any: [{ field: { key: 'city', op: SegmentRuleOp.EQ, value: 'NYC' } }] }] };

    await service.createSegment('workspace-1', { name: 'VIPs in NYC', rules });

    expect(prisma.segment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: 'workspace-1', rules }) }),
    );
  });
});

describe('ContactsService segments — rule evaluation (buildSegmentWhere)', () => {
  it('translates a tag rule into a tags.some.tag.name filter', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({ id: 'segment-1', workspaceId: 'workspace-1', rules: { tag: 'vip' } });

    await service.getSegmentMembers('workspace-1', 'segment-1');

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tags: { some: { tag: { name: 'vip' } } } }),
      }),
    );
  });

  it('translates an "all" rule into an AND of its children', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({
      id: 'segment-1',
      workspaceId: 'workspace-1',
      rules: { all: [{ tag: 'vip' }, { tag: 'engaged' }] },
    });

    await service.getSegmentMembers('workspace-1', 'segment-1');

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ tags: { some: { tag: { name: 'vip' } } } }, { tags: { some: { tag: { name: 'engaged' } } } }],
        }),
      }),
    );
  });

  it('translates an "any" rule into an OR of its children', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({
      id: 'segment-1',
      workspaceId: 'workspace-1',
      rules: { any: [{ tag: 'vip' }, { tag: 'engaged' }] },
    });

    await service.getSegmentMembers('workspace-1', 'segment-1');

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ tags: { some: { tag: { name: 'vip' } } } }, { tags: { some: { tag: { name: 'engaged' } } } }],
        }),
      }),
    );
  });

  it('translates a field EQ rule into a customField.key + value.equals filter', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({
      id: 'segment-1',
      workspaceId: 'workspace-1',
      rules: { field: { key: 'plan', op: SegmentRuleOp.EQ, value: 'pro' } },
    });

    await service.getSegmentMembers('workspace-1', 'segment-1');

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fieldValues: { some: { customField: { key: 'plan' }, value: { equals: 'pro' } } },
        }),
      }),
    );
  });

  it('translates a field CONTAINS rule into a case-insensitive contains filter', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({
      id: 'segment-1',
      workspaceId: 'workspace-1',
      rules: { field: { key: 'city', op: SegmentRuleOp.CONTAINS, value: 'york' } },
    });

    await service.getSegmentMembers('workspace-1', 'segment-1');

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fieldValues: { some: { customField: { key: 'city' }, value: { contains: 'york', mode: 'insensitive' } } },
        }),
      }),
    );
  });

  it('404s when the segment belongs to a different workspace', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({ id: 'segment-1', workspaceId: 'someone-elses-workspace', rules: { tag: 'x' } });

    await expect(service.getSegmentMembers('workspace-1', 'segment-1')).rejects.toThrow(NotFoundAppException);
  });

  it('filters listContacts by a segment when segmentId is provided', async () => {
    const { service, prisma } = makeService();
    prisma.segment.findUnique.mockResolvedValue({ id: 'segment-1', workspaceId: 'workspace-1', rules: { tag: 'vip' } });

    await service.listContacts('workspace-1', { segmentId: 'segment-1' });

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tags: { some: { tag: { name: 'vip' } } } }),
      }),
    );
  });
});
