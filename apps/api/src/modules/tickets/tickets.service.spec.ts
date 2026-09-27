import 'reflect-metadata';

// Same ESM-only stand-ins as the other service specs (see
// automations.service.spec.ts): the service is constructed directly, so the
// decorators only need to be harmless.
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
    Inject: () => () => {},
    Global: () => () => {},
    Module: () => () => {},
    Logger,
    HttpException,
    HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/bullmq', () => ({ InjectQueue: () => () => {} }));

import { TicketSource, TicketStatus, TriggerSource } from '@prisma/client';
import { TicketsService, computeReplyOptions, matchesKeyword } from './tickets.service';
import { AppException, NotFoundAppException } from '../../common/utils/app-exception';

const NOW = new Date('2026-09-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => hoursAgo(d * 24);

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    workspaceId: 'ws-1',
    instagramAccountId: 'acc-1',
    externalEventId: 'ext-1',
    source: TriggerSource.COMMENT,
    mediaId: 'media-1',
    fromUsername: 'angry_user',
    fromIgScopedId: 'igsid-1',
    text: 'This is broken @brand',
    receivedAt: NOW,
    instagramAccount: { igUsername: 'brand' },
    ...overrides,
  };
}

function makeService(settings: Record<string, unknown> = {}) {
  const prisma = {
    commentEvent: { findUnique: jest.fn() },
    ticketSettings: {
      upsert: jest.fn().mockResolvedValue({
        enabled: true,
        keywords: ['refund', 'broken'],
        createFromMentions: true,
        createFromAllDms: false,
        createFromStoryMentions: true,
        createFromReferrals: false,
        createFromTaggedPosts: true,
        ...settings,
      }),
      update: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { number: 4 } }),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ticket-new', status: TicketStatus.OPEN, ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    ticketParticipant: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'part-new', ...data })),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
    },
    ticketMessage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'msg-1', ...data })),
    },
    ticketEvent: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const instagramService = { getMediaInfo: jest.fn().mockResolvedValue({ permalink: 'https://instagram.com/p/x', caption: null }) } as any;
  const messagingService = { sendManual: jest.fn().mockResolvedValue({ status: 'SENT', externalId: 'mid-1' }) } as any;
  const contactsService = {
    findByIgScopedId: jest.fn().mockResolvedValue({ id: 'contact-1' }),
    recordOutbound: jest.fn().mockResolvedValue(undefined),
  } as any;
  const teamService = {
    getMember: jest.fn().mockResolvedValue({ id: 'user-2' }),
    listMembers: jest.fn().mockResolvedValue([]),
  } as any;
  const liveEvents = { publish: jest.fn().mockResolvedValue(undefined) } as any;
  const mergeTagsService = { render: jest.fn((text: string) => Promise.resolve(text)) } as any;
  const service = new TicketsService(prisma, instagramService, messagingService, contactsService, teamService, liveEvents, mergeTagsService);
  return { service, prisma, instagramService, messagingService, contactsService, teamService, liveEvents, mergeTagsService };
}

describe('matchesKeyword', () => {
  it('is case-insensitive and ignores empty keywords', () => {
    expect(matchesKeyword('I want a REFUND now', ['refund'])).toBe(true);
    expect(matchesKeyword('all good', ['refund'])).toBe(false);
    expect(matchesKeyword('anything', ['', '  '])).toBe(false);
  });
});

describe('computeReplyOptions', () => {
  const base = { igScopedId: 'igsid-1', lastInboundAt: null, latestCommentId: null, latestCommentAt: null, privateReplySentAt: null };

  it('allows a normal DM within 24h of their last message', () => {
    expect(computeReplyOptions({ ...base, lastInboundAt: hoursAgo(3) }, NOW).dmMode).toBe('DM');
  });

  it('falls back to the single private reply within 7 days of their comment', () => {
    const o = computeReplyOptions({ ...base, latestCommentId: 'c1', latestCommentAt: daysAgo(2) }, NOW);
    expect(o.dmMode).toBe('PRIVATE_REPLY');
    expect(o.canPublicReply).toBe(true);
  });

  it('refuses a second private reply and explains why', () => {
    const o = computeReplyOptions({ ...base, latestCommentId: 'c1', latestCommentAt: daysAgo(1), privateReplySentAt: hoursAgo(1) }, NOW);
    expect(o.dmMode).toBeNull();
    expect(o.dmUnavailableReason).toMatch(/one private reply/);
  });

  it('past 24h but within 7 days of their last message, a person can still reply with the Human Agent tag', () => {
    const o = computeReplyOptions({ ...base, lastInboundAt: hoursAgo(30) }, NOW);
    expect(o.dmMode).toBe('HUMAN_AGENT');
    expect(computeReplyOptions({ ...base, lastInboundAt: daysAgo(6) }, NOW).dmMode).toBe('HUMAN_AGENT');
  });

  it('after 7 days nothing but their own new message reopens a chat, and says so', () => {
    const o = computeReplyOptions({ ...base, lastInboundAt: daysAgo(8), latestCommentId: 'c1', latestCommentAt: daysAgo(9) }, NOW);
    expect(o.dmMode).toBeNull();
    expect(o.dmUnavailableReason).toMatch(/more than 7 days/);
    expect(o.canPublicReply).toBe(true);
  });

  it('cannot message anyone without an IG-scoped id (tagged posts)', () => {
    const o = computeReplyOptions({ ...base, igScopedId: null }, NOW);
    expect(o.dmMode).toBeNull();
    expect(o.canPublicReply).toBe(false);
  });
});

describe('TicketsService.ingestEvent', () => {
  it('opens a ticket when a comment @mentions the account', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'hey @brand your app crashes' }));

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 5, dedupKey: 'media:media-1', source: TicketSource.COMMENT }),
      }),
    );
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'INBOUND', channel: 'COMMENT', externalId: 'ext-1' }) }),
    );
  });

  it('opens a ticket when a comment matches a complaint keyword', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'I want a refund' }));

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
  });

  it('publishes a live event when a message lands on a ticket', async () => {
    const { service, prisma, liveEvents } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'I want a refund' }));

    await service.ingestEvent('event-1');

    expect(liveEvents.publish).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', instagramAccountId: 'acc-1', reason: 'created' }));
  });

  it('ignores an ordinary comment', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'love this!' }));

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
  });

  it('leaves a new ticket unassigned when auto-assign is off (the existing default)', async () => {
    const { service, prisma, teamService } = makeService({ autoAssignEnabled: false });
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'I want a refund' }));

    await service.ingestEvent('event-1');

    expect(teamService.listMembers).not.toHaveBeenCalled();
    expect(prisma.ticket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assigneeId: undefined }) }));
  });

  it('auto-assigns a new ticket to whichever member currently has the fewest open tickets', async () => {
    const { service, prisma, teamService } = makeService({ autoAssignEnabled: true });
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'I want a refund' }));
    teamService.listMembers.mockResolvedValue([{ id: 'user-a' }, { id: 'user-b' }, { id: 'user-c' }]);
    prisma.ticket.groupBy.mockResolvedValue([
      { assigneeId: 'user-a', _count: { _all: 3 } },
      { assigneeId: 'user-b', _count: { _all: 0 } },
    ]);

    await service.ingestEvent('event-1');

    expect(prisma.ticket.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws-1', assigneeId: { not: null } }) }),
    );
    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: 'user-b',
          events: { create: expect.arrayContaining([expect.objectContaining({ type: 'ASSIGNED', data: { assigneeId: 'user-b', auto: true } })]) },
        }),
      }),
    );
  });

  it('auto-assign is a no-op when the workspace has no team members', async () => {
    const { service, prisma, teamService } = makeService({ autoAssignEnabled: true });
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'I want a refund' }));
    teamService.listMembers.mockResolvedValue([]);

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assigneeId: undefined }) }));
  });

  it('does nothing when ticketing is switched off for the workspace', async () => {
    const { service, prisma } = makeService({ enabled: false });
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent());

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('puts a second complainer on the same post into the existing ticket instead of a new one', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ fromIgScopedId: 'igsid-2', fromUsername: 'other', externalEventId: 'ext-2' }));
    prisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      status: TicketStatus.IN_PROGRESS,
      participants: [{ igScopedId: 'igsid-1' }],
    });

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(prisma.ticketParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: 'ticket-1', igScopedId: 'igsid-2' }) }),
    );
    expect(prisma.ticketEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'PARTICIPANT_JOINED' }) }));
  });

  it('ignores further complaints on a post whose ticket is resolved: no new ticket and no reopening', async () => {
    const { service, prisma, liveEvents } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ fromIgScopedId: 'brand-new-person' }));
    prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: TicketStatus.RESOLVED, participants: [{ igScopedId: 'igsid-1' }] });

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
    expect(prisma.ticketEvent.create).not.toHaveBeenCalled();
    expect(liveEvents.publish).not.toHaveBeenCalled();
  });

  it('also ignores a closed post ticket, and a tagged post whose ticket is resolved', async () => {
    const closed = makeService();
    closed.prisma.commentEvent.findUnique.mockResolvedValue(makeEvent());
    closed.prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: TicketStatus.CLOSED, participants: [] });
    await closed.service.ingestEvent('event-1');
    expect(closed.prisma.ticketMessage.create).not.toHaveBeenCalled();

    const tagged = makeService();
    tagged.prisma.instagramAccount = { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }) };
    tagged.prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-9', status: TicketStatus.RESOLVED, participants: [] });
    await tagged.service.ingestTaggedPost('acc-1', { id: 'tag-1', caption: 'again', permalink: null, username: 'x', timestamp: null });
    expect(tagged.prisma.ticketMessage.create).not.toHaveBeenCalled();
  });

  it('still lets an open post ticket take new complaints', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ fromIgScopedId: 'igsid-2', fromUsername: 'other', externalEventId: 'ext-5' }));
    prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: TicketStatus.IN_PROGRESS, participants: [] });

    await service.ingestEvent('event-1');

    expect(prisma.ticketMessage.create).toHaveBeenCalledTimes(1);
  });

  it('lets someone already on the ticket keep commenting without any keyword', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ text: 'any update?' }));
    prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: TicketStatus.OPEN, participants: [{ igScopedId: 'igsid-1' }] });
    prisma.ticketParticipant.findUnique.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1' });

    await service.ingestEvent('event-1');

    expect(prisma.ticketMessage.create).toHaveBeenCalledTimes(1);
  });

  it('skips a redelivered webhook whose message is already on the ticket', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent());
    prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: TicketStatus.OPEN, participants: [] });
    prisma.ticketMessage.findUnique.mockResolvedValue({ id: 'existing' });

    await service.ingestEvent('event-1');

    expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
  });

  it('attaches a DM to the sender’s open ticket even with no keyword', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(
      makeEvent({ source: TriggerSource.DM, mediaId: null, text: 'thanks!', fromIgScopedId: 'igsid-1', fromUsername: 'igsid-1' }),
    );
    prisma.ticketParticipant.findFirst
      .mockResolvedValueOnce({ id: 'part-1', ticket: { id: 'ticket-1', source: TicketSource.COMMENT, dedupKey: 'media:media-1', mediaId: 'media-1', status: TicketStatus.WAITING } })
      .mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1' });
    prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: TicketStatus.WAITING, participants: [] });
    prisma.ticketParticipant.findUnique.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1' });

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: 'DM' }) }));
    // The DM re-opens the 24h window for replying.
    expect(prisma.ticketParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastInboundAt: NOW }) }),
    );
  });

  it('ignores a first DM that matches nothing when "all DMs" is off', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ source: TriggerSource.DM, text: 'hello', mediaId: null }));

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('creates one ticket per person for story mentions when enabled', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ source: TriggerSource.STORY_MENTION, text: '', mediaId: null }));

    await service.ingestEvent('event-1');

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dedupKey: 'story:igsid-1', source: TicketSource.STORY_MENTION }) }),
    );
  });

  it('only opens referral tickets when that setting is on', async () => {
    const off = makeService();
    off.prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ source: TriggerSource.REFERRAL, text: 'summer', mediaId: null }));
    await off.service.ingestEvent('event-1');
    expect(off.prisma.ticket.create).not.toHaveBeenCalled();

    const on = makeService({ createFromReferrals: true });
    on.prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ source: TriggerSource.REFERRAL, text: 'summer', mediaId: null }));
    await on.service.ingestEvent('event-1');
    expect(on.prisma.ticket.create).toHaveBeenCalledTimes(1);
  });
});

describe('TicketsService per-account scoping', () => {
  it('reads ticket rules for the account the event belongs to, not the whole workspace', async () => {
    const { service, prisma } = makeService();
    prisma.commentEvent.findUnique.mockResolvedValue(makeEvent({ instagramAccountId: 'acc-7', text: 'love this!' }));

    await service.ingestEvent('event-1');

    expect(prisma.ticketSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instagramAccountId: 'acc-7' }, create: { workspaceId: 'ws-1', instagramAccountId: 'acc-7' } }),
    );
  });

  it('lists and counts only the selected account’s tickets', async () => {
    const { service, prisma } = makeService();
    prisma.ticket.count = jest.fn().mockResolvedValue(0);
    prisma.ticket.findMany = jest.fn().mockResolvedValue([]);
    prisma.ticket.groupBy = jest.fn().mockResolvedValue([]);
    const user = { userId: 'u1', workspaceId: 'ws-1', role: 'OWNER', email: 'a@b.c' };

    await service.list('ws-1', 'acc-7', user, {});
    await service.counts('ws-1', 'acc-7', user);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws-1', instagramAccountId: 'acc-7' }) }));
    expect(prisma.ticket.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: 'ws-1', instagramAccountId: 'acc-7' } }));
  });
});

describe('TicketsService.getHistory', () => {
  it('reads the whole DM thread from Instagram for a person on the ticket', async () => {
    const { service, prisma, instagramService } = makeService();
    prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', workspaceId: 'ws-1', instagramAccountId: 'acc-1' });
    prisma.ticketParticipant.findFirst.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1', igScopedId: 'igsid-1' });
    instagramService.fetchDmHistory = jest.fn().mockResolvedValue([{ id: 'm1', text: 'hi', fromCustomer: true, createdAt: 'x', hasAttachment: false }]);

    const result = await service.getHistory('ws-1', 'ticket-1', 'part-1');

    expect(instagramService.fetchDmHistory).toHaveBeenCalledWith('acc-1', 'igsid-1');
    expect(result).toEqual({ available: true, messages: [expect.objectContaining({ id: 'm1' })] });
  });

  it('says so when Instagram cannot be reached instead of failing the page', async () => {
    const { service, prisma, instagramService } = makeService();
    prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', workspaceId: 'ws-1', instagramAccountId: 'acc-1' });
    prisma.ticketParticipant.findFirst.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1', igScopedId: 'igsid-1' });
    instagramService.fetchDmHistory = jest.fn().mockResolvedValue(null);

    await expect(service.getHistory('ws-1', 'ticket-1', 'part-1')).resolves.toEqual({ available: false, messages: [] });
  });

  it('has no thread for someone we cannot message (tagged posts)', async () => {
    const { service, prisma, instagramService } = makeService();
    prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', workspaceId: 'ws-1', instagramAccountId: 'acc-1' });
    prisma.ticketParticipant.findFirst.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1', igScopedId: null });
    instagramService.fetchDmHistory = jest.fn();

    await expect(service.getHistory('ws-1', 'ticket-1', 'part-1')).resolves.toEqual({ available: true, messages: [] });
    expect(instagramService.fetchDmHistory).not.toHaveBeenCalled();
  });
});

describe('TicketsService.ingestTaggedPost', () => {
  it('creates a read-only ticket keyed on the tagged media, with no messageable participant', async () => {
    const { service, prisma } = makeService();
    prisma.instagramAccount = { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }) };

    await service.ingestTaggedPost('acc-1', {
      id: 'tag-1',
      caption: 'Worst product ever @brand',
      permalink: 'https://instagram.com/p/tag',
      username: 'reviewer',
      timestamp: '2026-09-27T10:00:00+0000',
    });

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dedupKey: 'media:tag-1', source: TicketSource.TAGGED_POST }) }),
    );
    expect(prisma.ticketParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ igScopedId: null, username: 'reviewer' }) }),
    );
  });
});

describe('TicketsService.reply', () => {
  const user = { userId: 'user-1', workspaceId: 'ws-1', role: 'MEMBER', email: 'a@b.c' };
  const ticket = { id: 'ticket-1', workspaceId: 'ws-1', instagramAccountId: 'acc-1', status: TicketStatus.OPEN, firstResponseAt: null, assigneeId: 'user-2' };

  function setup(participant: Record<string, unknown>) {
    const ctx = makeService();
    ctx.prisma.ticket.findFirst.mockResolvedValue(ticket);
    ctx.prisma.ticketParticipant.findFirst.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1', igScopedId: 'igsid-1', ...participant });
    return ctx;
  }

  it('sends a normal DM inside the 24h window and moves the ticket to In progress', async () => {
    const { service, prisma, messagingService, contactsService } = setup({ lastInboundAt: new Date() });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: ' We are on it ' });

    expect(messagingService.sendManual).toHaveBeenCalledWith(
      expect.objectContaining({ recipientType: 'user', recipientId: 'igsid-1', actionType: 'SEND_DM', content: { text: 'We are on it' } }),
    );
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'OUTBOUND', status: 'SENT', externalId: 'mid-1', authorUserId: 'user-1' }) }),
    );
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.IN_PROGRESS }) }),
    );
    expect(contactsService.recordOutbound).toHaveBeenCalledWith('ws-1', 'acc-1', 'igsid-1');
  });

  it('uses the one private reply to the comment when no DM window is open, and records it', async () => {
    const { service, prisma, messagingService } = setup({ latestCommentId: 'comment-9', latestCommentAt: new Date() });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'Sorry about that' });

    expect(messagingService.sendManual).toHaveBeenCalledWith(
      expect.objectContaining({ recipientType: 'comment', recipientId: 'comment-9', actionType: 'SEND_DM' }),
    );
    expect(prisma.ticketParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ privateReplySentAt: expect.any(Date) }) }),
    );
  });

  it('refuses a DM when no window is open and does not call Instagram', async () => {
    const { service, messagingService } = setup({ lastInboundAt: daysAgo(9) });

    await expect(service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hi' })).rejects.toThrow(AppException);
    expect(messagingService.sendManual).not.toHaveBeenCalled();
  });

  it('replies with the Human Agent tag once 24h have passed but 7 days have not', async () => {
    const { service, prisma, messagingService } = setup({ lastInboundAt: daysAgo(3) });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'We fixed it, please check' });

    expect(messagingService.sendManual).toHaveBeenCalledWith(
      expect.objectContaining({ recipientType: 'user', recipientId: 'igsid-1', actionType: 'SEND_DM', humanAgent: true }),
    );
    // A normal in-window DM does not carry the tag.
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
  });

  it('does not use the Human Agent tag inside the 24h window', async () => {
    const { service, messagingService } = setup({ lastInboundAt: new Date() });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hi' });

    expect(messagingService.sendManual.mock.calls[0][0].humanAgent).toBeUndefined();
  });

  it('explains a rejected Human Agent message, since it needs the approved permission', async () => {
    const { service, prisma, messagingService } = setup({ lastInboundAt: daysAgo(3) });
    messagingService.sendManual.mockResolvedValue({ status: 'FAILED', error: '(#10) Application does not have permission' });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hello' });

    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', error: expect.stringContaining('Human Agent') }) }),
    );
  });

  it('tells connected browsers about the new reply', async () => {
    const { service, liveEvents } = setup({ lastInboundAt: new Date() });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hi' });

    expect(liveEvents.publish).toHaveBeenCalledWith({ workspaceId: 'ws-1', instagramAccountId: 'acc-1', ticketId: 'ticket-1', reason: 'reply' });
  });

  it('sends a public reply under their latest comment', async () => {
    const { service, messagingService } = setup({ latestCommentId: 'comment-9', latestCommentAt: daysAgo(30) });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'PUBLIC_REPLY', text: 'Thanks for flagging' });

    expect(messagingService.sendManual).toHaveBeenCalledWith(
      expect.objectContaining({ recipientType: 'comment', recipientId: 'comment-9', actionType: 'REPLY_COMMENT' }),
    );
  });

  it('keeps a failed send visible on the ticket and leaves the ticket status alone', async () => {
    const { service, prisma, messagingService } = setup({ lastInboundAt: new Date() });
    messagingService.sendManual.mockResolvedValue({ status: 'FAILED', error: 'Outside the messaging window' });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hello' });

    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', error: 'Outside the messaging window' }) }),
    );
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a participant that is not on this ticket', async () => {
    const ctx = makeService();
    ctx.prisma.ticket.findFirst.mockResolvedValue(ticket);
    ctx.prisma.ticketParticipant.findFirst.mockResolvedValue(null);

    await expect(ctx.service.reply('ws-1', user, 'ticket-1', { participantId: 'other', channel: 'DM', text: 'hi' })).rejects.toThrow(NotFoundAppException);
  });

  it('refuses a DM on an unassigned ticket, even when the DM window is otherwise open', async () => {
    const ctx = makeService();
    ctx.prisma.ticket.findFirst.mockResolvedValue({ ...ticket, assigneeId: null });
    ctx.prisma.ticketParticipant.findFirst.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1', igScopedId: 'igsid-1', lastInboundAt: new Date() });

    await expect(
      ctx.service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hi' }),
    ).rejects.toThrow(AppException);
    expect(ctx.messagingService.sendManual).not.toHaveBeenCalled();
  });

  it('allows a public reply on an unassigned ticket (only DM requires an assignee)', async () => {
    const ctx = makeService();
    ctx.prisma.ticket.findFirst.mockResolvedValue({ ...ticket, assigneeId: null });
    ctx.prisma.ticketParticipant.findFirst.mockResolvedValue({ id: 'part-1', ticketId: 'ticket-1', igScopedId: 'igsid-1', latestCommentId: 'comment-9', latestCommentAt: new Date() });

    await ctx.service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'PUBLIC_REPLY', text: 'Thanks for flagging' });

    expect(ctx.messagingService.sendManual).toHaveBeenCalled();
  });

  it('renders merge tags in the reply text before sending', async () => {
    const { service, prisma, messagingService, mergeTagsService } = setup({ lastInboundAt: new Date(), username: 'jane' });
    mergeTagsService.render.mockResolvedValue('Hey Jane, sorry about that!');

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'Hey {{username}}, sorry about that!' });

    expect(mergeTagsService.render).toHaveBeenCalledWith('Hey {{username}}, sorry about that!', {
      workspaceId: 'ws-1',
      instagramAccountId: 'acc-1',
      igScopedId: 'igsid-1',
      username: 'jane',
    });
    expect(messagingService.sendManual).toHaveBeenCalledWith(expect.objectContaining({ content: { text: 'Hey Jane, sorry about that!' } }));
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: 'Hey Jane, sorry about that!' }) }),
    );
  });

  it('quote-replies to a specific earlier message via reply_to.mid, resolved from the ticket message id', async () => {
    const { service, prisma, messagingService } = setup({ lastInboundAt: new Date() });
    prisma.ticketMessage.findFirst = jest.fn().mockResolvedValue({ externalId: 'mid-original-1' });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'following up', replyToMessageId: 'msg-original-1' });

    expect(prisma.ticketMessage.findFirst).toHaveBeenCalledWith({ where: { id: 'msg-original-1', ticketId: 'ticket-1' }, select: { externalId: true } });
    expect(messagingService.sendManual).toHaveBeenCalledWith(expect.objectContaining({ replyToMid: 'mid-original-1' }));
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ replyToMessageId: 'msg-original-1' }) }),
    );
  });

  it('404s a quote-reply to a message that is not on this ticket', async () => {
    const { service, prisma } = setup({ lastInboundAt: new Date() });
    prisma.ticketMessage.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hi', replyToMessageId: 'not-on-ticket' }),
    ).rejects.toThrow(NotFoundAppException);
  });

  it('ignores a quote-reply target for a private reply (not a supported combination)', async () => {
    const { service, prisma, messagingService } = setup({ latestCommentId: 'comment-9', latestCommentAt: new Date() });

    await service.reply('ws-1', user, 'ticket-1', { participantId: 'part-1', channel: 'DM', text: 'hi', replyToMessageId: 'msg-x' });

    expect(prisma.ticketMessage.findFirst).not.toHaveBeenCalled();
    expect(messagingService.sendManual.mock.calls[0][0].replyToMid).toBeUndefined();
  });
});

describe('TicketsService.update', () => {
  const user = { userId: 'user-1', workspaceId: 'ws-1', role: 'ADMIN', email: 'a@b.c' };
  const open = { id: 'ticket-1', workspaceId: 'ws-1', status: TicketStatus.OPEN, priority: 'NORMAL', assigneeId: null, subject: 'x' };

  function setup() {
    const ctx = makeService();
    ctx.prisma.ticket.findFirst.mockResolvedValue({ ...open, participants: [], messages: [], events: [], instagramAccount: {}, assignee: null });
    return ctx;
  }

  it('stamps resolvedAt and logs the change when resolving', async () => {
    const { service, prisma } = setup();

    await service.update('ws-1', user, 'ticket-1', { status: TicketStatus.RESOLVED });

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TicketStatus.RESOLVED,
          resolvedAt: expect.any(Date),
          events: { create: [expect.objectContaining({ type: 'STATUS_CHANGED', actorUserId: 'user-1' })] },
        }),
      }),
    );
  });

  it('only assigns to people in the same workspace', async () => {
    const { service, prisma, teamService } = setup();
    teamService.getMember.mockRejectedValue(new NotFoundAppException('MEMBER_NOT_FOUND', 'nope'));

    await expect(service.update('ws-1', user, 'ticket-1', { assigneeId: 'stranger' })).rejects.toThrow(NotFoundAppException);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('does nothing when nothing changed', async () => {
    const { service, prisma } = setup();

    await service.update('ws-1', user, 'ticket-1', { status: TicketStatus.OPEN });

    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('cannot touch a ticket from another workspace', async () => {
    const ctx = makeService();
    ctx.prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(ctx.service.update('ws-1', user, 'ticket-x', { status: TicketStatus.CLOSED })).rejects.toThrow(NotFoundAppException);
  });
});
