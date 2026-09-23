jest.mock('@nestjs/common', () => {
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
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/bullmq', () => ({ InjectQueue: () => () => {} }));

import { createHmac } from 'node:crypto';
import { WebhooksService } from './webhooks.service';

const INSTAGRAM_APP_SECRET = 'instagram-login-app-secret';
const MAIN_APP_SECRET = 'main-meta-app-secret';

function makeService(metaOverrides: Record<string, unknown> = {}) {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'meta') {
        return {
          appSecret: MAIN_APP_SECRET,
          webhookVerifyToken: 'verify-token',
          instagramAppSecret: INSTAGRAM_APP_SECRET,
          ...metaOverrides,
        };
      }
      throw new Error(`unexpected config key ${key}`);
    }),
  } as any;

  const redis = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn() } as any;
  const queue = { add: jest.fn().mockResolvedValue(undefined) } as any;
  const postbackQueue = { add: jest.fn().mockResolvedValue(undefined) } as any;
  const service = new WebhooksService(configService, redis, queue, postbackQueue);
  return { service, redis, queue, postbackQueue };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    externalEventId: '18095218910439494', // Meta ids are always numeric strings
    instagramAccountId: 'ig-account-1',
    source: 'COMMENT' as const,
    fromUsername: 'viewer123',
    text: 'PRICE please',
    receivedAt: new Date().toISOString(),
    ...overrides,
  };
}

function sign(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('WebhooksService.verifySignature', () => {
  it('accepts a payload signed with the Instagram Business Login app secret', () => {
    const { service } = makeService();
    const rawBody = Buffer.from(JSON.stringify({ object: 'instagram' }));

    const result = service.verifySignature(rawBody, sign(INSTAGRAM_APP_SECRET, rawBody.toString()));

    expect(result).toBe(true);
  });

  it('rejects a payload signed with the main Meta app secret (the historical bug)', () => {
    const { service } = makeService();
    const rawBody = Buffer.from(JSON.stringify({ object: 'instagram' }));

    const result = service.verifySignature(rawBody, sign(MAIN_APP_SECRET, rawBody.toString()));

    expect(result).toBe(false);
  });

  it('falls back to the main app secret when no Instagram app secret is configured', () => {
    const { service } = makeService({ instagramAppSecret: undefined });
    const rawBody = Buffer.from(JSON.stringify({ object: 'instagram' }));

    const result = service.verifySignature(rawBody, sign(MAIN_APP_SECRET, rawBody.toString()));

    expect(result).toBe(true);
  });

  it('rejects a missing signature header', () => {
    const { service } = makeService();
    const rawBody = Buffer.from(JSON.stringify({ object: 'instagram' }));

    expect(service.verifySignature(rawBody, undefined)).toBe(false);
  });

  it('rejects a malformed signature header without the sha256= prefix', () => {
    const { service } = makeService();
    const rawBody = Buffer.from(JSON.stringify({ object: 'instagram' }));

    expect(service.verifySignature(rawBody, 'not-a-real-signature')).toBe(false);
  });

  it('rejects a signature computed over a different body (tampered payload)', () => {
    const { service } = makeService();
    const rawBody = Buffer.from(JSON.stringify({ object: 'instagram', tampered: true }));
    const signatureForDifferentBody = sign(INSTAGRAM_APP_SECRET, JSON.stringify({ object: 'instagram' }));

    expect(service.verifySignature(rawBody, signatureForDifferentBody)).toBe(false);
  });
});

describe('WebhooksService.enqueueIfNew', () => {
  it('never passes an all-digit BullMQ jobId (real production bug: every comment webhook 500ed)', async () => {
    // Regression test: BullMQ 5.x's Job.validateOptions throws "Custom Id
    // cannot be integers" for a bare numeric jobId. Meta's externalEventId
    // is always a numeric string, so passing it straight through as jobId
    // crashed every single webhook delivery in production - confirmed live
    // via VPS logs (POST /api/webhooks/instagram -> 500) on 2026-09-22.
    const { service, queue } = makeService();

    await service.enqueueIfNew(makeEvent());

    const [, , options] = queue.add.mock.calls[0];
    expect(options.jobId).not.toMatch(/^\d+$/);
    expect(options.jobId).toContain('18095218910439494');
  });

  it('returns false and never enqueues when the event was already seen (dedup)', async () => {
    const { service, redis, queue } = makeService();
    redis.set.mockResolvedValue(null); // NX set failed - key already exists

    const result = await service.enqueueIfNew(makeEvent());

    expect(result).toBe(false);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('clears the dedup key when the enqueue itself fails, so a retry gets a real second try', async () => {
    // Regression test: previously the Redis dedup key was set BEFORE the
    // BullMQ add, so a failed add (like the jobId bug above) permanently
    // blackholed the event - any redelivery of the same webhook was then
    // dropped as "already seen" despite never having been queued.
    const { service, redis, queue } = makeService();
    queue.add.mockRejectedValue(new Error('Custom Id cannot be integers'));

    await expect(service.enqueueIfNew(makeEvent())).rejects.toThrow('Custom Id cannot be integers');

    expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('18095218910439494'));
  });
});

describe('WebhooksService.enqueuePostbackIfNew', () => {
  const postbackEvent = { instagramAccountId: 'account-1', senderId: 'user-1', payload: 'action-1:0', mid: 'mid-1' };

  it('enqueues onto the postback queue, keyed off the postback mid', async () => {
    const { service, postbackQueue } = makeService();

    await service.enqueuePostbackIfNew(postbackEvent);

    expect(postbackQueue.add).toHaveBeenCalledWith('process-postback', postbackEvent, { jobId: 'postback-webhook-mid-1' });
  });

  it('returns false and never enqueues a duplicate postback delivery', async () => {
    const { service, redis, postbackQueue } = makeService();
    redis.set.mockResolvedValue(null);

    const result = await service.enqueuePostbackIfNew(postbackEvent);

    expect(result).toBe(false);
    expect(postbackQueue.add).not.toHaveBeenCalled();
  });
});
