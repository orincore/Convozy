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

import { ActionType, MessageLogStatus } from '@prisma/client';
import { MessagingService } from './messaging.service';

function makeConfigService() {
  return { get: jest.fn(() => ({ graphApiVersion: 'v21.0' })) } as any;
}

function makeJob(data: Record<string, unknown>, attemptsMade = 0) {
  return { data, attemptsMade } as any;
}

function makeService(overrides: {
  circuitOpen?: boolean;
  rateLimitAllowed?: boolean;
  credentials?: { accessToken: string; igBusinessId: string } | null;
} = {}) {
  const prisma = { messageLog: { create: jest.fn() } } as any;
  const instagramService = {
    getSendCredentials: jest.fn().mockResolvedValue(
      overrides.credentials !== undefined
        ? overrides.credentials
        : { accessToken: 'token-abc', igBusinessId: 'ig-user-1' },
    ),
  } as any;
  const rateLimiter = {
    tryConsume: jest.fn().mockResolvedValue({ allowed: overrides.rateLimitAllowed ?? true, retryAfterSeconds: 120 }),
  } as any;
  const circuitBreaker = {
    isOpen: jest.fn().mockResolvedValue(overrides.circuitOpen ?? false),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  } as any;

  const service = new MessagingService(prisma, makeConfigService(), instagramService, rateLimiter, circuitBreaker);
  return { service, prisma, instagramService, rateLimiter, circuitBreaker };
}

describe('MessagingService.send', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends a private reply for SEND_DM to the correct endpoint/body and records SENT', async () => {
    const { service, prisma, circuitBreaker } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: 'mid-1' }) }) as any;

    await service.send(
      makeJob({
        workspaceId: 'workspace-1',
        instagramAccountId: 'account-1',
        recipientId: 'comment-123',
        recipientType: 'comment',
        actionType: ActionType.SEND_DM,
        content: { text: 'hi there' },
        commentEventId: 'ce-1',
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.instagram.com/v21.0/ig-user-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
        body: JSON.stringify({ recipient: { comment_id: 'comment-123' }, message: { text: 'hi there' } }),
      }),
    );
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: MessageLogStatus.SENT, attempt: 1 }) }),
    );
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('account-1');
  });

  it('sends a public reply for REPLY_COMMENT to the /{comment-id}/replies endpoint', async () => {
    const { service } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'reply-1' }) }) as any;

    await service.send(
      makeJob({
        workspaceId: 'workspace-1',
        instagramAccountId: 'account-1',
        recipientId: 'comment-123',
        recipientType: 'comment',
        actionType: ActionType.REPLY_COMMENT,
        content: { text: 'thanks!' },
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.instagram.com/v21.0/comment-123/replies',
      expect.objectContaining({ body: JSON.stringify({ message: 'thanks!' }) }),
    );
  });

  it('sends into a conversation with a plain user id for a story-reply/DM-sourced event', async () => {
    const { service } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;

    await service.send(
      makeJob({
        workspaceId: 'workspace-1',
        instagramAccountId: 'account-1',
        recipientId: 'ig-scoped-user-1',
        recipientType: 'user',
        actionType: ActionType.SEND_DM,
        content: { text: 'thanks for replying to our story!' },
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.instagram.com/v21.0/ig-user-1/messages',
      expect.objectContaining({
        body: JSON.stringify({
          recipient: { id: 'ig-scoped-user-1' },
          message: { text: 'thanks for replying to our story!' },
        }),
      }),
    );
  });

  it('rejects REPLY_COMMENT for a conversation-sourced (non-comment) recipient rather than sending a malformed request', async () => {
    const { service } = makeService();
    global.fetch = jest.fn() as any;

    await expect(
      service.send(
        makeJob({
          workspaceId: 'workspace-1',
          instagramAccountId: 'account-1',
          recipientId: 'ig-scoped-user-1',
          recipientType: 'user',
          actionType: ActionType.REPLY_COMMENT,
          content: { text: 'thanks!' },
        }),
      ),
    ).rejects.toThrow(/requires a comment-sourced event/);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('hides a comment for HIDE_COMMENT via a hide=true query param, not a JSON body field', async () => {
    const { service, prisma } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as any;

    await service.send(
      makeJob({
        workspaceId: 'workspace-1',
        instagramAccountId: 'account-1',
        recipientId: 'comment-123',
        recipientType: 'comment',
        actionType: ActionType.HIDE_COMMENT,
        content: {},
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.instagram.com/v21.0/comment-123?hide=true',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({}) }),
    );
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: MessageLogStatus.SENT }) }),
    );
  });

  it('rejects HIDE_COMMENT for a conversation-sourced (non-comment) recipient rather than sending a malformed request', async () => {
    const { service } = makeService();
    global.fetch = jest.fn() as any;

    await expect(
      service.send(
        makeJob({
          workspaceId: 'workspace-1',
          instagramAccountId: 'account-1',
          recipientId: 'ig-scoped-user-1',
          recipientType: 'user',
          actionType: ActionType.HIDE_COMMENT,
          content: {},
        }),
      ),
    ).rejects.toThrow(/requires a comment-sourced event/);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends a real Button Template message for a WEB_URL button, not a flattened plain-text fallback', async () => {
    const { service } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;

    await service.send(
      makeJob({
        workspaceId: 'workspace-1',
        instagramAccountId: 'account-1',
        recipientId: 'ig-scoped-user-1',
        recipientType: 'user',
        actionType: ActionType.SEND_DM,
        content: { text: 'here', buttons: [{ title: 'Shop', type: 'WEB_URL', url: 'https://example.com' }] },
      }),
    );

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.message).toEqual({
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'here',
          buttons: [{ type: 'web_url', title: 'Shop', url: 'https://example.com' }],
        },
      },
    });
  });

  it('sends a POSTBACK button with its stored payload string in the Button Template', async () => {
    const { service } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;

    await service.send(
      makeJob({
        workspaceId: 'workspace-1',
        instagramAccountId: 'account-1',
        recipientId: 'ig-scoped-user-1',
        recipientType: 'user',
        actionType: ActionType.SEND_DM,
        content: {
          text: 'pick one',
          buttons: [{ title: 'Get the link', type: 'POSTBACK', payload: 'action-1:0' }],
        },
      }),
    );

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.message.attachment.payload.buttons).toEqual([
      { type: 'postback', title: 'Get the link', payload: 'action-1:0' },
    ]);
  });

  it('short-circuits without calling fetch when the circuit is open', async () => {
    const { service, prisma, circuitBreaker } = makeService({ circuitOpen: true });
    global.fetch = jest.fn() as any;

    await expect(service.send(makeJob({ instagramAccountId: 'account-1', actionType: ActionType.SEND_DM }))).rejects.toThrow(
      /Circuit open/,
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(circuitBreaker.recordFailure).not.toHaveBeenCalled(); // breaker already open — not a new failure
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: MessageLogStatus.RATE_LIMITED, errorCode: 'CIRCUIT_OPEN' }) }),
    );
  });

  it('short-circuits without calling fetch when the rate limit is exceeded', async () => {
    const { service, prisma } = makeService({ rateLimitAllowed: false });
    global.fetch = jest.fn() as any;

    await expect(
      service.send(makeJob({ instagramAccountId: 'account-1', actionType: ActionType.SEND_DM })),
    ).rejects.toThrow(/Rate limit exceeded/);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorCode: 'RATE_LIMIT_EXCEEDED' }) }),
    );
  });

  it('records FAILED and returns (no throw) when the account has no usable credentials', async () => {
    const { service, prisma } = makeService({ credentials: null });
    global.fetch = jest.fn() as any;

    await expect(
      service.send(makeJob({ instagramAccountId: 'account-1', actionType: ActionType.SEND_DM })),
    ).resolves.toBeUndefined();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorCode: 'INSTAGRAM_ACCOUNT_UNAVAILABLE' }) }),
    );
  });

  it('records the failure, trips the breaker, and does NOT rethrow (no auto-retry) on a non-429 Graph API error', async () => {
    // Regression test for a real production incident (2026-09-24): a
    // REPLY_COMMENT posted 5 real times because BullMQ auto-retried on
    // every Graph API error, including ambiguous 5xx responses where
    // Meta's write may have already completed. Any confirmed HTTP response
    // from Meta other than 429 must not be auto-retried for a
    // non-idempotent send — see the comment in MessagingService.send.
    const { service, prisma, circuitBreaker } = makeService();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid parameter' } }),
    }) as any;

    await expect(
      service.send(
        makeJob({
          workspaceId: 'workspace-1',
          instagramAccountId: 'account-1',
          recipientId: 'comment-123',
          actionType: ActionType.SEND_DM,
          content: { text: 'hi' },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('account-1');
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: MessageLogStatus.FAILED, errorCode: 'Invalid parameter' }) }),
    );
  });

  it('does NOT rethrow on an ambiguous 500 Graph API error either (the exact production incident)', async () => {
    const { service, prisma } = makeService();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'An unknown error has occurred.', type: 'OAuthException', code: 1 } }),
    }) as any;

    await expect(
      service.send(
        makeJob({
          workspaceId: 'workspace-1',
          instagramAccountId: 'account-1',
          recipientId: 'comment-123',
          recipientType: 'comment',
          actionType: ActionType.REPLY_COMMENT,
          content: { text: 'thanks!' },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MessageLogStatus.FAILED, errorCode: 'An unknown error has occurred.' }),
      }),
    );
  });

  it('DOES rethrow (auto-retry) on a genuine network-level failure with no Graph API response at all', async () => {
    const { service, circuitBreaker } = makeService();
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed: ECONNRESET')) as any;

    await expect(
      service.send(
        makeJob({
          workspaceId: 'workspace-1',
          instagramAccountId: 'account-1',
          recipientId: 'comment-123',
          actionType: ActionType.SEND_DM,
          content: { text: 'hi' },
        }),
      ),
    ).rejects.toThrow('ECONNRESET');

    expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('account-1');
  });

  it('classifies a 429 Graph API response as RATE_LIMITED in the MessageLog', async () => {
    const { service, prisma } = makeService();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Too many calls' } }),
    }) as any;

    await expect(
      service.send(makeJob({ instagramAccountId: 'account-1', actionType: ActionType.SEND_DM, content: { text: 'hi' } })),
    ).rejects.toThrow();

    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: MessageLogStatus.RATE_LIMITED }) }),
    );
  });

  it('uses job.attemptsMade + 1 as the MessageLog attempt number', async () => {
    const { service, prisma } = makeService();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;

    await service.send(
      makeJob({ instagramAccountId: 'account-1', actionType: ActionType.SEND_DM, content: { text: 'hi' } }, 3),
    );

    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempt: 4 }) }),
    );
  });
});
