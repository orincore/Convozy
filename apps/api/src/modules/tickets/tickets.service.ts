import { Injectable, Logger } from '@nestjs/common';
import {
  ActionType,
  Prisma,
  Ticket,
  TicketMessageChannel,
  TicketMessageKind,
  TicketMessageStatus,
  TicketParticipant,
  TicketSource,
  TicketStatus,
  TriggerSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { AppException, NotFoundAppException } from '../../common/utils/app-exception';
import { InstagramService } from '../instagram/instagram.service';
import { MessagingService } from '../messaging/messaging.service';
import { ContactsService } from '../contacts/contacts.service';
import { TeamService } from '../team/team.service';
import { ListTicketsQueryDto } from './dto/list-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketSettingsDto } from './dto/update-settings.dto';
import { NoteDto, ReplyDto } from './dto/reply.dto';

// Meta's messaging rules (Send API / Private Replies docs): a DM may be sent
// within 24h of the person's last message to you; a private reply to a comment
// only once and only within 7 days of that comment.
const DM_WINDOW_MS = 24 * 60 * 60 * 1000;
const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const CLOSED_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

export interface ReplyOptions {
  canPublicReply: boolean;
  // How a DM would go out right now, or null with the reason it can't.
  dmMode: 'DM' | 'PRIVATE_REPLY' | null;
  dmUnavailableReason: string | null;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function matchesKeyword(text: string, keywords: string[]): boolean {
  const haystack = text.toLowerCase();
  return keywords.some((k) => k.trim() !== '' && haystack.includes(k.trim().toLowerCase()));
}

/** What an agent may send to one participant right now, per Meta's rules. */
export function computeReplyOptions(p: Pick<TicketParticipant, 'igScopedId' | 'lastInboundAt' | 'latestCommentId' | 'latestCommentAt' | 'privateReplySentAt'>, now = new Date()): ReplyOptions {
  const canPublicReply = Boolean(p.latestCommentId);
  if (!p.igScopedId) {
    return {
      canPublicReply: false,
      dmMode: null,
      dmUnavailableReason: 'Instagram does not share this person’s ID for tagged posts, so you cannot message them from here.',
    };
  }
  if (p.lastInboundAt && now.getTime() - p.lastInboundAt.getTime() < DM_WINDOW_MS) {
    return { canPublicReply, dmMode: 'DM', dmUnavailableReason: null };
  }
  if (
    p.latestCommentId &&
    !p.privateReplySentAt &&
    p.latestCommentAt &&
    now.getTime() - p.latestCommentAt.getTime() < PRIVATE_REPLY_WINDOW_MS
  ) {
    return { canPublicReply, dmMode: 'PRIVATE_REPLY', dmUnavailableReason: null };
  }
  return {
    canPublicReply,
    dmMode: null,
    dmUnavailableReason: p.privateReplySentAt
      ? 'You already sent the one private reply Instagram allows for this comment. You can message them again once they reply.'
      : 'The 24-hour messaging window has closed. You can message them again once they message you.',
  };
}

interface IngestTarget {
  workspaceId: string;
  instagramAccountId: string;
  source: TicketSource;
  dedupKey: string;
  subject: string;
  mediaId?: string | null;
  participant: { igScopedId: string | null; username: string | null };
  message: { channel: TicketMessageChannel; text: string; externalId: string; at: Date };
  comment?: { id: string; at: Date };
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramService: InstagramService,
    private readonly messagingService: MessagingService,
    private readonly contactsService: ContactsService,
    private readonly teamService: TeamService,
  ) {}

  // ── Settings ────────────────────────────────────────────────────────────

  /** What opens tickets for one Instagram account; created with defaults on first read. */
  getSettings(workspaceId: string, instagramAccountId: string) {
    return this.prisma.ticketSettings.upsert({
      where: { instagramAccountId },
      create: { workspaceId, instagramAccountId },
      update: {},
    });
  }

  async updateSettings(workspaceId: string, instagramAccountId: string, dto: UpdateTicketSettingsDto) {
    await this.getSettings(workspaceId, instagramAccountId);
    return this.prisma.ticketSettings.update({
      where: { instagramAccountId },
      data: {
        ...dto,
        keywords: dto.keywords ? Array.from(new Set(dto.keywords.map((k) => k.trim()).filter(Boolean))) : undefined,
      },
    });
  }

  // ── Ingest (called by the webhook worker for every inbound event) ───────

  /**
   * Turns an inbound event into a ticket message when it qualifies. Grouping:
   * several people complaining about the same post share one ticket; a person
   * who is already on an open ticket and messages again continues it; a new
   * complaint on a resolved/closed ticket reopens it rather than creating a
   * duplicate. Idempotent per Meta event id.
   */
  async ingestEvent(commentEventId: string): Promise<void> {
    const event = await this.prisma.commentEvent.findUnique({
      where: { id: commentEventId },
      include: { instagramAccount: { select: { igUsername: true } } },
    });
    if (!event) return;

    const settings = await this.getSettings(event.workspaceId, event.instagramAccountId);
    if (!settings.enabled) return;

    const isComment = event.source === TriggerSource.COMMENT || event.source === TriggerSource.LIVE_COMMENT;
    const igScopedId = event.fromIgScopedId ?? (isComment ? null : event.fromUsername);
    const username = isComment ? event.fromUsername : null;
    const text = event.text ?? '';
    const handle = event.instagramAccount.igUsername;
    const keywordHit = matchesKeyword(text, settings.keywords);
    const mentionHit = settings.createFromMentions && Boolean(handle) && text.toLowerCase().includes(`@${handle.toLowerCase()}`);
    const qualifies = keywordHit || mentionHit;
    const base = { workspaceId: event.workspaceId, instagramAccountId: event.instagramAccountId };
    const participant = { igScopedId, username };

    if (isComment) {
      const dedupKey = event.mediaId ? `media:${event.mediaId}` : `comment:${event.externalEventId}`;
      const existing = await this.prisma.ticket.findUnique({
        where: { instagramAccountId_dedupKey: { instagramAccountId: event.instagramAccountId, dedupKey } },
        include: { participants: { select: { igScopedId: true } } },
      });
      const alreadyOn = existing?.participants.some((p) => p.igScopedId === igScopedId) ?? false;
      if (!qualifies && !alreadyOn) return;
      await this.ingest({
        ...base,
        source: TicketSource.COMMENT,
        dedupKey,
        subject: truncate(text, 80) || 'Comment',
        mediaId: event.mediaId,
        participant,
        message: { channel: TicketMessageChannel.COMMENT, text, externalId: event.externalEventId, at: event.receivedAt },
        comment: { id: event.externalEventId, at: event.receivedAt },
      });
      return;
    }

    if (!igScopedId) return;

    if (event.source === TriggerSource.DM) {
      // A DM from someone already on a ticket continues that conversation,
      // whatever it says. Otherwise it needs a keyword (or "all DMs").
      const ongoing = await this.prisma.ticketParticipant.findFirst({
        where: { igScopedId, ticket: { instagramAccountId: event.instagramAccountId, status: { not: TicketStatus.CLOSED } } },
        orderBy: { ticket: { lastActivityAt: 'desc' } },
        include: { ticket: true },
      });
      if (!ongoing && !settings.createFromAllDms && !keywordHit) return;
      await this.ingest({
        ...base,
        source: ongoing?.ticket.source ?? TicketSource.DM,
        dedupKey: ongoing?.ticket.dedupKey ?? `dm:${igScopedId}`,
        subject: truncate(text, 80) || 'Direct message',
        mediaId: ongoing?.ticket.mediaId,
        participant,
        message: { channel: TicketMessageChannel.DM, text: text || '[attachment]', externalId: event.externalEventId, at: event.receivedAt },
        dm: true,
      });
      return;
    }

    if (event.source === TriggerSource.STORY_MENTION && settings.createFromStoryMentions) {
      await this.ingest({
        ...base,
        source: TicketSource.STORY_MENTION,
        dedupKey: `story:${igScopedId}`,
        subject: 'Mentioned your account in a story',
        participant,
        message: { channel: TicketMessageChannel.DM, text: 'Mentioned your account in their story.', externalId: event.externalEventId, at: event.receivedAt },
        dm: true,
      });
      return;
    }

    if (event.source === TriggerSource.REFERRAL && settings.createFromReferrals) {
      await this.ingest({
        ...base,
        source: TicketSource.REFERRAL,
        dedupKey: `ref:${igScopedId}`,
        subject: text ? `Started a chat from link: ${truncate(text, 60)}` : 'Started a chat from your link',
        participant,
        message: { channel: TicketMessageChannel.DM, text: text ? `Opened a chat via your link (ref: ${text}).` : 'Opened a chat via your link.', externalId: event.externalEventId, at: event.receivedAt },
        dm: true,
      });
    }
  }

  /** A public post that tags the account, found by the periodic tagged-posts sync. Read-only: nobody to message. */
  async ingestTaggedPost(
    instagramAccountId: string,
    item: { id: string; caption: string | null; permalink: string | null; username: string | null; timestamp: string | null },
  ): Promise<void> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { workspaceId: true },
    });
    if (!account) return;
    const settings = await this.getSettings(account.workspaceId, instagramAccountId);
    if (!settings.enabled || !settings.createFromTaggedPosts) return;

    await this.ingest({
      workspaceId: account.workspaceId,
      instagramAccountId,
      source: TicketSource.TAGGED_POST,
      dedupKey: `media:${item.id}`,
      subject: truncate(item.caption ?? '', 80) || `Tagged by @${item.username ?? 'someone'}`,
      mediaId: item.id,
      mediaPermalink: item.permalink,
      participant: { igScopedId: null, username: item.username },
      message: {
        channel: TicketMessageChannel.TAGGED_POST,
        text: item.caption?.trim() || 'Tagged your account in a post.',
        externalId: item.id,
        at: item.timestamp ? new Date(item.timestamp) : new Date(),
      },
    });
  }

  private async ingest(target: IngestTarget & { dm?: boolean; mediaPermalink?: string | null }): Promise<void> {
    const { workspaceId, instagramAccountId, dedupKey } = target;

    let ticket = await this.prisma.ticket.findUnique({
      where: { instagramAccountId_dedupKey: { instagramAccountId, dedupKey } },
    });
    let created = false;
    if (!ticket) {
      ({ ticket, created } = await this.createTicket(target));
    }

    // Redelivered webhook: this exact message is already on the ticket.
    const duplicate = await this.prisma.ticketMessage.findUnique({
      where: { ticketId_externalId: { ticketId: ticket.id, externalId: target.message.externalId } },
      select: { id: true },
    });
    if (duplicate) return;

    const { igScopedId, username } = target.participant;
    let participant = igScopedId
      ? await this.prisma.ticketParticipant.findUnique({ where: { ticketId_igScopedId: { ticketId: ticket.id, igScopedId } } })
      : await this.prisma.ticketParticipant.findFirst({ where: { ticketId: ticket.id, igScopedId: null, username } });

    const contact = igScopedId ? await this.contactsService.findByIgScopedId(workspaceId, instagramAccountId, igScopedId) : null;
    const participantUpdate: Prisma.TicketParticipantUpdateInput = {
      username: username ?? undefined,
      ...(target.dm ? { lastInboundAt: target.message.at } : {}),
      ...(target.comment ? { latestCommentId: target.comment.id, latestCommentAt: target.comment.at } : {}),
    };
    if (participant) {
      participant = await this.prisma.ticketParticipant.update({ where: { id: participant.id }, data: participantUpdate });
    } else {
      participant = await this.prisma.ticketParticipant.create({
        data: {
          ticketId: ticket.id,
          contactId: contact?.id,
          igScopedId,
          username,
          lastInboundAt: target.dm ? target.message.at : undefined,
          latestCommentId: target.comment?.id,
          latestCommentAt: target.comment?.at,
        },
      });
      if (!created) {
        await this.prisma.ticketEvent.create({
          data: { ticketId: ticket.id, type: 'PARTICIPANT_JOINED', data: { username, igScopedId } },
        });
      }
    }

    await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        participantId: participant.id,
        kind: TicketMessageKind.INBOUND,
        channel: target.message.channel,
        text: target.message.text,
        externalId: target.message.externalId,
        createdAt: target.message.at,
      },
    });

    const reopen = !created && (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastActivityAt: new Date(),
        // A new message on a waiting/resolved ticket needs a person's attention again.
        ...(reopen || ticket.status === TicketStatus.WAITING ? { status: TicketStatus.OPEN, resolvedAt: null } : {}),
      },
    });
    if (reopen) {
      await this.prisma.ticketEvent.create({
        data: { ticketId: ticket.id, type: 'REOPENED', data: { from: ticket.status, reason: 'New message' } },
      });
    }
  }

  private async createTicket(target: IngestTarget & { mediaPermalink?: string | null }): Promise<{ ticket: Ticket; created: boolean }> {
    let permalink = target.mediaPermalink ?? null;
    if (target.mediaId && !permalink && target.source === TicketSource.COMMENT) {
      permalink = (await this.instagramService.getMediaInfo(target.instagramAccountId, target.mediaId))?.permalink ?? null;
    }

    // The per-workspace number and the dedup key are both unique: a clash on
    // the number retries with the next one, a clash on the dedup key means a
    // concurrent event just created this ticket, so use that one.
    for (let attempt = 0; attempt < 5; attempt++) {
      const max = await this.prisma.ticket.aggregate({ where: { workspaceId: target.workspaceId }, _max: { number: true } });
      try {
        const ticket = await this.prisma.ticket.create({
          data: {
            workspaceId: target.workspaceId,
            instagramAccountId: target.instagramAccountId,
            number: (max._max.number ?? 0) + 1,
            source: target.source,
            subject: target.subject,
            dedupKey: target.dedupKey,
            mediaId: target.mediaId ?? undefined,
            mediaPermalink: permalink ?? undefined,
            events: { create: { type: 'CREATED', data: { source: target.source } } },
          },
        });
        return { ticket, created: true };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await this.prisma.ticket.findUnique({
            where: { instagramAccountId_dedupKey: { instagramAccountId: target.instagramAccountId, dedupKey: target.dedupKey } },
          });
          if (existing) return { ticket: existing, created: false };
          continue;
        }
        throw err;
      }
    }
    throw new AppException('TICKET_NUMBER_CONFLICT', 'Could not allocate a ticket number, please retry.');
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  async list(workspaceId: string, instagramAccountId: string, user: RequestUser, query: ListTicketsQueryDto) {
    const where: Prisma.TicketWhereInput = { workspaceId, instagramAccountId };
    if (query.status) where.status = query.status;
    else if ((query.view ?? 'active') === 'active') where.status = { notIn: CLOSED_STATUSES };
    else if (query.view === 'closed') where.status = { in: CLOSED_STATUSES };
    if (query.priority) where.priority = query.priority;
    if (query.source) where.source = query.source;
    if (query.assignee === 'me') where.assigneeId = user.userId;
    else if (query.assignee === 'unassigned') where.assigneeId = null;
    else if (query.assignee) where.assigneeId = query.assignee;
    if (query.search?.trim()) {
      const q = query.search.trim();
      const number = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null;
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { participants: { some: { username: { contains: q, mode: 'insensitive' } } } },
        ...(number !== null ? [{ number }] : []),
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          source: true,
          mediaPermalink: true,
          lastActivityAt: true,
          createdAt: true,
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { participants: true } },
          participants: { select: { username: true }, take: 3, orderBy: { createdAt: 'asc' } },
          messages: { select: { text: true, kind: true }, take: 1, orderBy: { createdAt: 'desc' } },
        },
      }),
    ]);
    return {
      total,
      page,
      limit,
      items: items.map(({ _count, messages, ...t }) => ({
        ...t,
        participantCount: _count.participants,
        lastMessage: messages[0] ? { text: truncate(messages[0].text, 120), kind: messages[0].kind } : null,
      })),
    };
  }

  async counts(workspaceId: string, instagramAccountId: string, user: RequestUser) {
    const [byStatus, unassigned, mine] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where: { workspaceId, instagramAccountId }, _count: { _all: true } }),
      this.prisma.ticket.count({ where: { workspaceId, instagramAccountId, assigneeId: null, status: { notIn: CLOSED_STATUSES } } }),
      this.prisma.ticket.count({ where: { workspaceId, instagramAccountId, assigneeId: user.userId, status: { notIn: CLOSED_STATUSES } } }),
    ]);
    const status: Record<string, number> = {};
    for (const row of byStatus) status[row.status] = row._count._all;
    const active = Object.entries(status)
      .filter(([s]) => !CLOSED_STATUSES.includes(s as TicketStatus))
      .reduce((sum, [, n]) => sum + n, 0);
    return { status, active, unassigned, mine };
  }

  async get(workspaceId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, workspaceId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        instagramAccount: { select: { id: true, igUsername: true } },
        participants: { orderBy: { createdAt: 'asc' } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true } } } },
      },
    });
    if (!ticket) {
      throw new NotFoundAppException('TICKET_NOT_FOUND', 'Ticket not found.');
    }
    const now = new Date();
    return {
      ...ticket,
      participants: ticket.participants.map((p) => ({ ...p, replyOptions: computeReplyOptions(p, now) })),
    };
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  async update(workspaceId: string, user: RequestUser, id: string, dto: UpdateTicketDto) {
    const ticket = await this.getOwned(workspaceId, id);
    const data: Prisma.TicketUpdateInput = {};
    const events: { type: string; data: Prisma.InputJsonValue }[] = [];

    if (dto.status && dto.status !== ticket.status) {
      data.status = dto.status;
      const closing = CLOSED_STATUSES.includes(dto.status);
      data.resolvedAt = closing ? new Date() : null;
      events.push({ type: 'STATUS_CHANGED', data: { from: ticket.status, to: dto.status } });
    }
    if (dto.priority && dto.priority !== ticket.priority) {
      data.priority = dto.priority;
      events.push({ type: 'PRIORITY_CHANGED', data: { from: ticket.priority, to: dto.priority } });
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== ticket.assigneeId) {
      if (dto.assigneeId === null) {
        data.assignee = { disconnect: true };
      } else {
        const member = await this.teamService.getMember(workspaceId, dto.assigneeId);
        data.assignee = { connect: { id: member.id } };
      }
      events.push({ type: 'ASSIGNED', data: { from: ticket.assigneeId, to: dto.assigneeId } });
    }
    if (dto.subject && dto.subject.trim() !== ticket.subject) {
      data.subject = dto.subject.trim();
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.ticket.update({
        where: { id },
        data: { ...data, events: { create: events.map((e) => ({ ...e, actorUserId: user.userId })) } },
      });
    }
    return this.get(workspaceId, id);
  }

  async addNote(workspaceId: string, user: RequestUser, id: string, dto: NoteDto) {
    await this.getOwned(workspaceId, id);
    const note = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        kind: TicketMessageKind.NOTE,
        channel: TicketMessageChannel.NOTE,
        text: dto.text.trim(),
        authorUserId: user.userId,
      },
      include: { author: { select: { id: true, name: true } } },
    });
    await this.prisma.ticket.update({ where: { id }, data: { lastActivityAt: new Date() } });
    return note;
  }

  async reply(workspaceId: string, user: RequestUser, id: string, dto: ReplyDto) {
    const ticket = await this.getOwned(workspaceId, id);
    const participant = await this.prisma.ticketParticipant.findFirst({ where: { id: dto.participantId, ticketId: id } });
    if (!participant) {
      throw new NotFoundAppException('PARTICIPANT_NOT_FOUND', 'That person is not on this ticket.');
    }
    const text = dto.text.trim();
    if (!text) {
      throw new AppException('EMPTY_MESSAGE', 'Write a message first.');
    }

    const options = computeReplyOptions(participant);
    let job: { recipientType: 'comment' | 'user'; recipientId: string; actionType: ActionType };
    let channel: TicketMessageChannel;
    let usedPrivateReply = false;

    if (dto.channel === 'PUBLIC_REPLY') {
      if (!options.canPublicReply || !participant.latestCommentId) {
        throw new AppException('NO_COMMENT_TO_REPLY', 'This person has no comment to reply to publicly.');
      }
      job = { recipientType: 'comment', recipientId: participant.latestCommentId, actionType: ActionType.REPLY_COMMENT };
      channel = TicketMessageChannel.PUBLIC_REPLY;
    } else {
      if (!options.dmMode || !participant.igScopedId) {
        throw new AppException('DM_NOT_ALLOWED', options.dmUnavailableReason ?? 'You cannot message this person right now.');
      }
      usedPrivateReply = options.dmMode === 'PRIVATE_REPLY';
      job = usedPrivateReply
        ? { recipientType: 'comment', recipientId: participant.latestCommentId as string, actionType: ActionType.SEND_DM }
        : { recipientType: 'user', recipientId: participant.igScopedId, actionType: ActionType.SEND_DM };
      channel = TicketMessageChannel.DM;
    }

    const result = await this.messagingService.sendManual({
      workspaceId,
      instagramAccountId: ticket.instagramAccountId,
      ...job,
      content: { text },
    });

    const failed = result.status === 'FAILED';
    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        participantId: participant.id,
        kind: TicketMessageKind.OUTBOUND,
        channel,
        text,
        externalId: !failed ? result.externalId : null,
        status: failed ? TicketMessageStatus.FAILED : TicketMessageStatus.SENT,
        error: failed ? result.error : null,
        authorUserId: user.userId,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    if (!failed) {
      if (usedPrivateReply) {
        await this.prisma.ticketParticipant.update({ where: { id: participant.id }, data: { privateReplySentAt: new Date() } });
      }
      if (participant.igScopedId && channel === TicketMessageChannel.DM) {
        await this.contactsService.recordOutbound(workspaceId, ticket.instagramAccountId, participant.igScopedId);
      }
      const startWork = ticket.status === TicketStatus.OPEN;
      await this.prisma.ticket.update({
        where: { id },
        data: {
          lastActivityAt: new Date(),
          firstResponseAt: ticket.firstResponseAt ?? new Date(),
          ...(startWork ? { status: TicketStatus.IN_PROGRESS } : {}),
          ...(startWork
            ? { events: { create: { type: 'STATUS_CHANGED', actorUserId: user.userId, data: { from: TicketStatus.OPEN, to: TicketStatus.IN_PROGRESS } } } }
            : {}),
        },
      });
    }
    return message;
  }

  private async getOwned(workspaceId: string, id: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, workspaceId } });
    if (!ticket) {
      throw new NotFoundAppException('TICKET_NOT_FOUND', 'Ticket not found.');
    }
    return ticket;
  }
}
