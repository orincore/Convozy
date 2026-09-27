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
    enqueuePostbackIfNew: jest.fn(),
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

function messagingPayload(event: Record<string, unknown>): MetaWebhookPayload {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig-business-1',
        time: 1700000000,
        messaging: [
          { sender: { id: 'ig-scoped-user-1' }, recipient: { id: 'ig-business-1' }, timestamp: 1700000000, ...event },
        ],
      },
    ],
  } as MetaWebhookPayload;
}

function changePayload(field: string, value: Record<string, unknown>): MetaWebhookPayload {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig-business-1',
        time: 1700000000,
        changes: [{ field, value }],
      },
    ],
  } as MetaWebhookPayload;
}

describe('WebhooksController.receive — comments vs live comments', () => {
  it('maps a "comments" field change to a COMMENT event', async () => {
    const { controller, webhooksService } = makeController();
    const payload = changePayload('comments', {
      id: 'comment-1',
      text: 'nice post',
      from: { id: 'ig-scoped-user-1', username: 'viewer1' },
      media: { id: 'media-1' },
    });

    await controller.receive(makeRequest(payload), 'sha256=x');

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ externalEventId: 'comment-1', source: 'COMMENT', mediaId: 'media-1' }),
    );
  });

  it('maps a "live_comments" field change to a LIVE_COMMENT event, not COMMENT', async () => {
    const { controller, webhooksService } = makeController();
    const payload = changePayload('live_comments', {
      id: 'live-comment-1',
      text: 'hi from the stream',
      from: { id: 'ig-scoped-user-2', username: 'viewer2' },
      media: { id: 'live-media-1' },
    });

    await controller.receive(makeRequest(payload), 'sha256=x');

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        externalEventId: 'live-comment-1',
        source: 'LIVE_COMMENT',
        mediaId: 'live-media-1',
        fromUsername: 'viewer2',
        fromIgScopedId: 'ig-scoped-user-2',
        text: 'hi from the stream',
      }),
    );
  });
});

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
        mediaId: 'story-1',
        text: 'love this!',
      }),
    );
  });

  it('enqueues a plain DM (no reply_to.story) as a DM event', async () => {
    const { controller, webhooksService } = makeController();
    await controller.receive(makeRequest(messagingPayload({ message: { mid: 'msg-2', text: 'hey there' } })), 'sha256=x');

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledTimes(1);
    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        externalEventId: 'msg-2',
        source: 'DM',
        text: 'hey there',
        fromUsername: 'ig-scoped-user-1',
        fromIgScopedId: 'ig-scoped-user-1',
      }),
    );
  });

  it('treats a reply-to-message (reply_to.mid) as an ordinary DM', async () => {
    const { controller, webhooksService } = makeController();
    await controller.receive(makeRequest(messagingPayload({ message: { mid: 'msg-3', text: 'ok', reply_to: {} } })), 'sha256=x');

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(expect.objectContaining({ source: 'DM', externalEventId: 'msg-3' }));
  });

  it('ignores echo, self, deleted and unsupported messages', async () => {
    const { controller, webhooksService } = makeController();
    for (const flag of ['is_echo', 'is_self', 'is_deleted', 'is_unsupported']) {
      await controller.receive(makeRequest(messagingPayload({ message: { mid: `m-${flag}`, text: 'x', [flag]: true } })), 'sha256=x');
    }

    expect(webhooksService.enqueueIfNew).not.toHaveBeenCalled();
  });
});

describe('WebhooksController.receive — story mentions and referrals', () => {
  it('enqueues a STORY_MENTION for a message with a story_mention attachment', async () => {
    const { controller, webhooksService } = makeController();
    await controller.receive(
      makeRequest(
        messagingPayload({ message: { mid: 'msg-4', attachments: [{ type: 'story_mention', payload: { url: 'https://cdn/x' } }] } }),
      ),
      'sha256=x',
    );

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledTimes(1);
    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ externalEventId: 'msg-4', source: 'STORY_MENTION', text: '' }),
    );
  });

  it('enqueues a REFERRAL (text = ref) for a messaging_referral event with no message', async () => {
    const { controller, webhooksService } = makeController();
    await controller.receive(
      makeRequest(messagingPayload({ referral: { ref: 'summer-sale', source: 'SHORTLINK', type: 'OPEN_THREAD' } })),
      'sha256=x',
    );

    expect(webhooksService.enqueueIfNew).toHaveBeenCalledTimes(1);
    expect(webhooksService.enqueueIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'REFERRAL', text: 'summer-sale', externalEventId: 'referral:ig-scoped-user-1:1700000000' }),
    );
  });

  it('emits both a REFERRAL and a DM event for a first message that carries a referral', async () => {
    const { controller, webhooksService } = makeController();
    await controller.receive(
      makeRequest(messagingPayload({ message: { mid: 'msg-5', text: 'hi', referral: { ref: 'summer-sale' } } })),
      'sha256=x',
    );

    const sources = webhooksService.enqueueIfNew.mock.calls.map((c: any[]) => [c[0].source, c[0].externalEventId]);
    expect(sources).toEqual([
      ['REFERRAL', 'msg-5:referral'],
      ['DM', 'msg-5'],
    ]);
  });
});

describe('WebhooksController.receive — messaging_postbacks', () => {
  it('routes a postback tap to enqueuePostbackIfNew, not the comment/DM pipeline', async () => {
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
              postback: { mid: 'mid-1', title: 'Get the link', payload: 'action-1:0' },
            },
          ],
        },
      ],
    };

    await controller.receive(makeRequest(payload), 'sha256=whatever');

    expect(webhooksService.enqueuePostbackIfNew).toHaveBeenCalledWith({
      instagramAccountId: 'account-1',
      senderId: 'ig-scoped-user-1',
      payload: 'action-1:0',
      mid: 'mid-1',
    });
    expect(webhooksService.enqueueIfNew).not.toHaveBeenCalled();
  });

  it('drops a postback from the connected account itself (self-authored guard applies here too)', async () => {
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
              sender: { id: 'ig-scoped-user-1' },
              recipient: { id: 'ig-business-1' },
              timestamp: 1700000000,
              postback: { mid: 'mid-1', title: 'Get the link', payload: 'action-1:0' },
            },
          ],
        },
      ],
    };

    await controller.receive(makeRequest(payload), 'sha256=whatever');

    expect(webhooksService.enqueuePostbackIfNew).not.toHaveBeenCalled();
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
