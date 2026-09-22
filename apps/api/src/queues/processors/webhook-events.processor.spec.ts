// contacts.service.ts (transitively imported below) pulls in DTOs with
// class-transformer @Type() decorators, which call Reflect.getMetadata at
// class-definition time — needs the polyfill loaded before anything
// decorated is imported, same as NestJS's own real bootstrap does.
import 'reflect-metadata';
import { Prisma } from '@prisma/client';

// @nestjs/bullmq (and its dependency @nestjs/bull-shared) ship ESM-only
// ("type": "module", no CJS build), which ts-jest's CommonJS transform can't
// load — see jest.config.js history / TRACKER.md. These tests never go
// through Nest's DI container (classes are constructed directly), so the
// decorators only need to be harmless no-ops rather than the real
// implementation.
jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => {},
  InjectQueue: () => () => {},
  WorkerHost: class {},
}));
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

import { WebhookEventsProcessor, WebhookEventJobData } from './webhook-events.processor';

function makeContactsService() {
  return { recordInbound: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeJob(data: Partial<WebhookEventJobData> = {}) {
  return {
    id: 'job-1',
    data: {
      externalEventId: 'evt-1',
      instagramAccountId: 'ig-account-1',
      source: 'COMMENT' as const,
      fromUsername: 'viewer123',
      text: 'PRICE',
      receivedAt: new Date().toISOString(),
      ...data,
    },
  } as any;
}

describe('WebhookEventsProcessor', () => {
  it('drops the event when the InstagramAccount no longer exists', async () => {
    const prisma = {
      instagramAccount: { findUnique: jest.fn().mockResolvedValue(null) },
      commentEvent: { create: jest.fn() },
    } as any;
    const queue = { add: jest.fn() } as any;

    const processor = new WebhookEventsProcessor(prisma, makeContactsService(), queue);
    await processor.process(makeJob());

    expect(prisma.commentEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('persists a CommentEvent and enqueues an automation-match job keyed by its id', async () => {
    const prisma = {
      instagramAccount: {
        findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }),
      },
      commentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'comment-event-1' }),
      },
    } as any;
    const queue = { add: jest.fn() } as any;

    const processor = new WebhookEventsProcessor(prisma, makeContactsService(), queue);
    await processor.process(makeJob());

    expect(prisma.commentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-1',
          instagramAccountId: 'ig-account-1',
          externalEventId: 'evt-1',
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'match',
      { commentEventId: 'comment-event-1' },
      { jobId: 'comment-event-1' },
    );
  });

  it('records the sender as a Contact for every inbound event, using the account and workspace from the job', async () => {
    const prisma = {
      instagramAccount: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }) },
      commentEvent: { create: jest.fn().mockResolvedValue({ id: 'comment-event-1' }) },
    } as any;
    const queue = { add: jest.fn() } as any;
    const contactsService = makeContactsService();

    const processor = new WebhookEventsProcessor(prisma, contactsService, queue);
    await processor.process(makeJob({ fromIgScopedId: 'ig-scoped-1', fromUsername: 'viewer123' }));

    expect(contactsService.recordInbound).toHaveBeenCalledWith(
      'workspace-1',
      'ig-account-1',
      'ig-scoped-1',
      'viewer123',
    );
  });

  it('never passes STORY_REPLY\'s numeric sender id as a display username', async () => {
    const prisma = {
      instagramAccount: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }) },
      commentEvent: { create: jest.fn().mockResolvedValue({ id: 'comment-event-1' }) },
    } as any;
    const queue = { add: jest.fn() } as any;
    const contactsService = makeContactsService();

    const processor = new WebhookEventsProcessor(prisma, contactsService, queue);
    await processor.process(
      makeJob({ source: 'STORY_REPLY', fromIgScopedId: 'ig-scoped-1', fromUsername: 'ig-scoped-1' }),
    );

    expect(contactsService.recordInbound).toHaveBeenCalledWith('workspace-1', 'ig-account-1', 'ig-scoped-1', undefined);
  });

  it('never lets a Contact-tracking failure block automation matching (non-fatal)', async () => {
    const prisma = {
      instagramAccount: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }) },
      commentEvent: { create: jest.fn().mockResolvedValue({ id: 'comment-event-1' }) },
    } as any;
    const queue = { add: jest.fn() } as any;
    const contactsService = { recordInbound: jest.fn().mockRejectedValue(new Error('db hiccup')) } as any;

    const processor = new WebhookEventsProcessor(prisma, contactsService, queue);
    await expect(processor.process(makeJob())).resolves.toBeUndefined();

    expect(queue.add).toHaveBeenCalled();
  });

  it('treats a Postgres unique-constraint violation as an already-processed duplicate, not an error', async () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const prisma = {
      instagramAccount: {
        findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }),
      },
      commentEvent: {
        create: jest.fn().mockRejectedValue(duplicateError),
      },
    } as any;
    const queue = { add: jest.fn() } as any;

    const processor = new WebhookEventsProcessor(prisma, makeContactsService(), queue);
    await expect(processor.process(makeJob())).resolves.toBeUndefined();

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rethrows non-duplicate database errors so BullMQ retries the job', async () => {
    const prisma = {
      instagramAccount: {
        findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }),
      },
      commentEvent: {
        create: jest.fn().mockRejectedValue(new Error('connection reset')),
      },
    } as any;
    const queue = { add: jest.fn() } as any;

    const processor = new WebhookEventsProcessor(prisma, makeContactsService(), queue);
    await expect(processor.process(makeJob())).rejects.toThrow('connection reset');
  });
});
