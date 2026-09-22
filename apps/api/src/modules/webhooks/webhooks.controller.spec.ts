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
  class BadRequestException extends Error {}
  return {
    Controller: () => () => {},
    Public: () => () => {},
    Get: () => () => {},
    Post: () => () => {},
    HttpCode: () => () => {},
    HttpStatus: { OK: 200, BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
    Headers: () => () => {},
    Query: () => () => {},
    Req: () => () => {},
    Param: () => () => {},
    SetMetadata: () => () => {},
    Inject: () => () => {},
    Injectable: () => () => {},
    Global: () => () => {},
    Module: () => () => {},
    Logger,
    BadRequestException,
    HttpException,
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/bullmq', () => ({ InjectQueue: () => () => {} }));

import { WebhooksController } from './webhooks.controller';
import { MetaWebhookPayload } from './dto/meta-webhook-payload.dto';

function makeController() {
  const webhooksService = {
    verifySignature: jest.fn().mockReturnValue(true),
    enqueueIfNew: jest.fn(),
  } as any;
  const instagramService = {
    findAccountIdByIgUserId: jest.fn().mockResolvedValue('account-1'),
  } as any;
  const controller = new WebhooksController(webhooksService, instagramService);
  return { controller, webhooksService, instagramService };
}

function makeRequest(payload: MetaWebhookPayload) {
  return { rawBody: Buffer.from(JSON.stringify(payload)), body: payload } as any;
}

describe('WebhooksController.receive — story replies', () => {
  it('enqueues a STORY_REPLY event for a message with reply_to.story', async () => {
    const { controller, webhooksService } = makeController();
    const payload: MetaWebhookPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-business-1',
          time: 1700000000,
          messaging: [
            {
              sender: { id: 'ig-scoped-user-1' },
              recipient: { id: 'ig-business-1' },
              timestamp: 1700000000,
              message: {
                mid: 'msg-1',
                text: 'love this!',
                reply_to: { story: { id: 'story-1', url: 'https://example.com/story' } },
              },
            },
          ],
        },
      ],
    };

    await controller.receive(makeRequest(payload), 'sha256=whatever');

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        externalEventId: 'msg-1',
        instagramAccountId: 'account-1',
        source: 'STORY_REPLY',
        fromUsername: 'ig-scoped-user-1',
        text: 'love this!',
      }),
    );
  });

  it('does not enqueue a plain DM (no reply_to.story) — DM automations are not implemented yet', async () => {
    const { controller, webhooksService } = makeController();
    const payload: MetaWebhookPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-business-1',
          time: 1700000000,
          messaging: [
            {
              sender: { id: 'ig-scoped-user-1' },
              recipient: { id: 'ig-business-1' },
              timestamp: 1700000000,
              message: { mid: 'msg-2', text: 'hey there' },
            },
          ],
        },
      ],
    };

    await controller.receive(makeRequest(payload), 'sha256=whatever');

    expect(webhooksService.enqueueIfNew).not.toHaveBeenCalled();
  });

  it('does not enqueue a reply-to-message (reply_to.mid, not reply_to.story)', async () => {
    const { controller, webhooksService } = makeController();
    const payload: MetaWebhookPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-business-1',
          time: 1700000000,
          messaging: [
            {
              sender: { id: 'ig-scoped-user-1' },
              recipient: { id: 'ig-business-1' },
              timestamp: 1700000000,
              message: { mid: 'msg-3', text: 'ok', reply_to: {} },
            },
          ],
        },
      ],
    };

    await controller.receive(makeRequest(payload), 'sha256=whatever');

    expect(webhooksService.enqueueIfNew).not.toHaveBeenCalled();
  });
});
