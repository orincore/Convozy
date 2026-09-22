import { Injectable, Logger } from '@nestjs/common';
import { Contact, CustomFieldType, Prisma, Segment, Tag } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException, NotFoundAppException } from '../../common/utils/app-exception';
import { CreateTagDto } from './dto/create-tag.dto';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { CreateSegmentDto, UpdateSegmentDto } from './dto/create-segment.dto';
import { SegmentRuleDto, SegmentRuleOp } from './dto/segment-rule.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';

const DEFAULT_PAGE_SIZE = 25;
// Mirrors AutomationsService.MAX_ACTION_TREE_DEPTH's reasoning — a sane,
// explicit recursion bound for nested segment rules, not a silent limit.
const MAX_SEGMENT_RULE_DEPTH = 5;

type ContactWithRelations = Contact & {
  tags: { tag: Tag }[];
  fieldValues: { customField: { key: string; label: string; type: CustomFieldType }; value: string }[];
};

/**
 * Owns Contact/Tag/CustomField/Segment — CLAUDE.md §3 rule 1: other modules
 * go through this service's exported methods (recordInbound, tag lookups
 * for segment evaluation, etc.), never the Prisma models directly. See
 * ARCHITECTURE.md/MANYCHAT_FEATURE_AUDIT.md §7 (Segmentation) for why this
 * exists: foundational for later Sequences (exit-on-reply) and Broadcasts
 * (segment targeting + 24h-window eligibility) milestones.
 */
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Contact lifecycle (called from the webhook pipeline) ────────────────

  /**
   * Idempotent upsert, called by WebhookEventsProcessor for every inbound
   * event (comment, live comment, story reply) regardless of whether it
   * matched an automation — a Contact should exist for anyone who has ever
   * interacted, not just people an automation happened to reply to. Never
   * throws on a missing igScopedId (some legacy/edge events don't have one
   * yet) — just no-ops, since there's nothing stable to key a Contact on.
   */
  async recordInbound(
    workspaceId: string,
    instagramAccountId: string,
    igScopedId: string | null | undefined,
    username?: string | null,
  ): Promise<void> {
    if (!igScopedId) {
      return;
    }
    await this.prisma.contact.upsert({
      where: { workspaceId_instagramAccountId_igScopedId: { workspaceId, instagramAccountId, igScopedId } },
      create: {
        workspaceId,
        instagramAccountId,
        igScopedId,
        username: username ?? undefined,
        lastInboundAt: new Date(),
      },
      update: {
        username: username ?? undefined,
        lastInboundAt: new Date(),
      },
    });
  }

  /** Called by MessagingService/AutomationsService once Sequences (Milestone 7) needs it — not wired in yet. */
  async recordOutbound(workspaceId: string, instagramAccountId: string, igScopedId: string): Promise<void> {
    await this.prisma.contact.updateMany({
      where: { workspaceId, instagramAccountId, igScopedId },
      data: { lastOutboundAt: new Date() },
    });
  }

  // ── Contacts (read + tag/field mutation) ─────────────────────────────────

  async listContacts(
    workspaceId: string,
    query: ListContactsQueryDto,
  ): Promise<{ contacts: ContactWithRelations[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.ContactWhereInput = { workspaceId };
    if (query.instagramAccountId) {
      where.instagramAccountId = query.instagramAccountId;
    }
    if (query.tagId) {
      where.tags = { some: { tagId: query.tagId } };
    }
    if (query.segmentId) {
      const segment = await this.getOwnedSegment(workspaceId, query.segmentId);
      const segmentWhere = this.buildSegmentWhere(segment.rules as unknown as SegmentRuleDto);
      Object.assign(where, segmentWhere);
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: { tags: { include: { tag: true } }, fieldValues: { include: { customField: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { contacts, total, page, pageSize };
  }

  async getContact(workspaceId: string, id: string): Promise<ContactWithRelations> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, fieldValues: { include: { customField: true } } },
    });
    if (!contact || contact.workspaceId !== workspaceId) {
      throw new NotFoundAppException('CONTACT_NOT_FOUND', 'Contact not found.');
    }
    return contact;
  }

  async addTagToContact(workspaceId: string, contactId: string, tagId: string): Promise<void> {
    await this.getOwnedContact(workspaceId, contactId);
    await this.getOwnedTag(workspaceId, tagId);
    await this.prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });
  }

  async removeTagFromContact(workspaceId: string, contactId: string, tagId: string): Promise<void> {
    await this.getOwnedContact(workspaceId, contactId);
    await this.prisma.contactTag.deleteMany({ where: { contactId, tagId } });
  }

  async setFieldValue(workspaceId: string, contactId: string, customFieldId: string, rawValue: string): Promise<void> {
    await this.getOwnedContact(workspaceId, contactId);
    const field = await this.getOwnedCustomField(workspaceId, customFieldId);
    this.validateFieldValue(field.type, rawValue);

    await this.prisma.contactFieldValue.upsert({
      where: { contactId_customFieldId: { contactId, customFieldId } },
      create: { contactId, customFieldId, value: rawValue },
      update: { value: rawValue },
    });
  }

  private validateFieldValue(type: CustomFieldType, value: string): void {
    switch (type) {
      case CustomFieldType.NUMBER:
        if (Number.isNaN(Number(value))) {
          throw new AppException('INVALID_FIELD_VALUE', `"${value}" is not a valid number.`);
        }
        return;
      case CustomFieldType.BOOLEAN:
        if (value !== 'true' && value !== 'false') {
          throw new AppException('INVALID_FIELD_VALUE', 'Boolean field values must be "true" or "false".');
        }
        return;
      case CustomFieldType.DATE:
        if (Number.isNaN(Date.parse(value))) {
          throw new AppException('INVALID_FIELD_VALUE', `"${value}" is not a valid date.`);
        }
        return;
      case CustomFieldType.TEXT:
        return;
      default:
        return;
    }
  }

  // ── Tags ──────────────────────────────────────────────────────────────

  listTags(workspaceId: string): Promise<Tag[]> {
    return this.prisma.tag.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
  }

  async createTag(workspaceId: string, dto: CreateTagDto): Promise<Tag> {
    return this.prisma.tag.create({ data: { workspaceId, name: dto.name, color: dto.color } });
  }

  async deleteTag(workspaceId: string, id: string): Promise<void> {
    await this.getOwnedTag(workspaceId, id);
    await this.prisma.tag.delete({ where: { id } });
  }

  private async getOwnedTag(workspaceId: string, id: string): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag || tag.workspaceId !== workspaceId) {
      throw new NotFoundAppException('TAG_NOT_FOUND', 'Tag not found.');
    }
    return tag;
  }

  private async getOwnedContact(workspaceId: string, id: string): Promise<Contact> {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact || contact.workspaceId !== workspaceId) {
      throw new NotFoundAppException('CONTACT_NOT_FOUND', 'Contact not found.');
    }
    return contact;
  }

  // ── Custom fields ─────────────────────────────────────────────────────

  listCustomFields(workspaceId: string) {
    return this.prisma.customField.findMany({ where: { workspaceId }, orderBy: { label: 'asc' } });
  }

  async createCustomField(workspaceId: string, dto: CreateCustomFieldDto) {
    return this.prisma.customField.create({
      data: { workspaceId, key: dto.key, label: dto.label, type: dto.type },
    });
  }

  async deleteCustomField(workspaceId: string, id: string): Promise<void> {
    await this.getOwnedCustomField(workspaceId, id);
    await this.prisma.customField.delete({ where: { id } });
  }

  private async getOwnedCustomField(workspaceId: string, id: string) {
    const field = await this.prisma.customField.findUnique({ where: { id } });
    if (!field || field.workspaceId !== workspaceId) {
      throw new NotFoundAppException('CUSTOM_FIELD_NOT_FOUND', 'Custom field not found.');
    }
    return field;
  }

  // ── Segments ──────────────────────────────────────────────────────────

  listSegments(workspaceId: string): Promise<Segment[]> {
    return this.prisma.segment.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
  }

  async getSegment(workspaceId: string, id: string): Promise<Segment> {
    return this.getOwnedSegment(workspaceId, id);
  }

  async createSegment(workspaceId: string, dto: CreateSegmentDto): Promise<Segment> {
    this.validateSegmentRule(dto.rules);
    return this.prisma.segment.create({
      data: { workspaceId, name: dto.name, rules: dto.rules as unknown as object },
    });
  }

  async updateSegment(workspaceId: string, id: string, dto: UpdateSegmentDto): Promise<Segment> {
    await this.getOwnedSegment(workspaceId, id);
    if (dto.rules) {
      this.validateSegmentRule(dto.rules);
    }
    return this.prisma.segment.update({
      where: { id },
      data: { name: dto.name, rules: dto.rules ? (dto.rules as unknown as object) : undefined },
    });
  }

  async deleteSegment(workspaceId: string, id: string): Promise<void> {
    await this.getOwnedSegment(workspaceId, id);
    await this.prisma.segment.delete({ where: { id } });
  }

  /** Evaluated at read time, never materialized/cached — a segment is never stale. Used directly by Milestone 8's Broadcasts later. */
  async getSegmentMembers(
    workspaceId: string,
    id: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<{ contacts: ContactWithRelations[]; total: number }> {
    const segment = await this.getOwnedSegment(workspaceId, id);
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      ...this.buildSegmentWhere(segment.rules as unknown as SegmentRuleDto),
    };
    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: { tags: { include: { tag: true } }, fieldValues: { include: { customField: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { contacts, total };
  }

  async getSegmentCount(workspaceId: string, id: string): Promise<number> {
    const segment = await this.getOwnedSegment(workspaceId, id);
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      ...this.buildSegmentWhere(segment.rules as unknown as SegmentRuleDto),
    };
    return this.prisma.contact.count({ where });
  }

  private async getOwnedSegment(workspaceId: string, id: string): Promise<Segment> {
    const segment = await this.prisma.segment.findUnique({ where: { id } });
    if (!segment || segment.workspaceId !== workspaceId) {
      throw new NotFoundAppException('SEGMENT_NOT_FOUND', 'Segment not found.');
    }
    return segment;
  }

  /** Exactly one of all/any/tag/field per node, bounded depth — mirrors AutomationsService.validateActionTree's shape. */
  private validateSegmentRule(rule: SegmentRuleDto, depth = 1): void {
    if (depth > MAX_SEGMENT_RULE_DEPTH) {
      throw new AppException('SEGMENT_RULE_TOO_DEEP', `Segment rules can nest at most ${MAX_SEGMENT_RULE_DEPTH} levels deep.`);
    }
    const branches = [rule.all, rule.any, rule.tag, rule.field].filter((b) => b !== undefined);
    if (branches.length !== 1) {
      throw new AppException('INVALID_SEGMENT_RULE', 'A segment rule node needs exactly one of: all, any, tag, field.');
    }
    rule.all?.forEach((r) => this.validateSegmentRule(r, depth + 1));
    rule.any?.forEach((r) => this.validateSegmentRule(r, depth + 1));
  }

  /**
   * Translates a validated rule tree into a Prisma where-clause fragment for
   * Contact. `neq` on a field means "has a value for this field and it
   * differs from X" (excludes contacts with no value at all) — the
   * symmetric, consistently-implementable counterpart to `eq`'s "has a
   * value and it equals X", not "any value including none."
   */
  private buildSegmentWhere(rule: SegmentRuleDto): Prisma.ContactWhereInput {
    if (rule.all) {
      return { AND: rule.all.map((r) => this.buildSegmentWhere(r)) };
    }
    if (rule.any) {
      return { OR: rule.any.map((r) => this.buildSegmentWhere(r)) };
    }
    if (rule.tag) {
      return { tags: { some: { tag: { name: rule.tag } } } };
    }
    if (rule.field) {
      const { key, op, value } = rule.field;
      const valueFilter: Prisma.StringFilter =
        op === SegmentRuleOp.EQ
          ? { equals: value }
          : op === SegmentRuleOp.NEQ
            ? { not: value }
            : { contains: value, mode: 'insensitive' };
      return { fieldValues: { some: { customField: { key }, value: valueFilter } } };
    }
    // Unreachable if validateSegmentRule ran first, but never silently
    // matches everyone if it somehow wasn't.
    throw new AppException('INVALID_SEGMENT_RULE', 'A segment rule node needs one of: all, any, tag, field.');
  }
}
