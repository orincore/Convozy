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
jest.mock('@nestjs/common', () => ({
  Injectable: () => () => {},
  Logger: class {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  },
}));

import { WebhookEventsProcessor, WebhookEventJobData } from './webhook-events.processor';

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

    const processor = new WebhookEventsProcessor(prisma, queue);
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

    const processor = new WebhookEventsProcessor(prisma, queue);
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

    const processor = new WebhookEventsProcessor(prisma, queue);
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

    const processor = new WebhookEventsProcessor(prisma, queue);
    await expect(processor.process(makeJob())).rejects.toThrow('connection reset');
  });
});
