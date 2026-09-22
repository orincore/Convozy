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
    isOwnAccountComment: jest.fn().mockResolvedValue(false),
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

describe('WebhooksController.receive — self-authored comment loop guard', () => {
  // Regression test for a real production incident (2026-09-24): a
  // REPLY_COMMENT automation replied to its own reply forever, because
  // Meta legitimately re-delivers the account's own public reply as a
  // fresh comment webhook event. See InstagramService.isOwnAccountComment.
  function commentPayload(from: { id: string; username: string }, id = 'comment-1'): MetaWebhookPayload {
    return {
      object: 'instagram',
      entry: [
        {
          id: 'ig-business-1',
          time: 1700000000,
          changes: [
            {
              field: 'comments',
              value: { id, text: 'nice post!', from, media: { id: 'media-1' } },
            },
          ],
        },
      ],
    };
  }

  it('enqueues a comment from a real viewer', async () => {
    const { controller, webhooksService } = makeController();

    await controller.receive(makeRequest(commentPayload({ id: 'viewer-1', username: 'a_real_viewer' })), 'sha256=x');

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'COMMENT', fromUsername: 'a_real_viewer' }),
    );
  });

  it('drops a comment the connected account posted about itself instead of enqueueing it', async () => {
    const { controller, webhooksService, instagramService } = makeController();
    instagramService.isOwnAccountComment.mockResolvedValue(true);

    await controller.receive(makeRequest(commentPayload({ id: 'own-id', username: 'ig_orincore' })), 'sha256=x');

    expect(instagramService.isOwnAccountComment).toHaveBeenCalledWith('account-1', { id: 'own-id', username: 'ig_orincore' });
    expect(webhooksService.enqueueIfNew).not.toHaveBeenCalled();
  });

  it('drops a self-authored messaging event the same way', async () => {
    const { controller, webhooksService, instagramService } = makeController();
    instagramService.isOwnAccountComment.mockResolvedValue(true);
    const payload: MetaWebhookPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-business-1',
          time: 1700000000,
          messaging: [
            {
              sender: { id: 'own-id' },
              recipient: { id: 'ig-business-1' },
              timestamp: 1700000000,
              message: { mid: 'msg-1', text: 'hi', reply_to: { story: { id: 's-1', url: 'x' } } },
            },
          ],
        },
      ],
    };

    await controller.receive(makeRequest(payload), 'sha256=x');

    expect(webhooksService.enqueueIfNew).not.toHaveBeenCalled();
  });
});
