import { InstagramAccountStatus } from '@prisma/client';

// @nestjs/common and @nestjs/config ship ESM-only in this NestJS 12 line
// (see jest.config.js history / TRACKER.md) — one of @nestjs/common's own
// files uses `import.meta.url`, which ts-jest's CommonJS transform can't
// parse. These tests construct InstagramService directly (bypassing Nest's
// DI container), so the decorators/classes only need to be harmless
// stand-ins, not the real implementations.
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

import { InstagramService } from './instagram.service';
import { encryptSecret } from '../../common/utils/crypto.util';

const TOKEN_ENCRYPTION_KEY = '0'.repeat(64); // valid 32-byte hex key for tests

function makeConfigService() {
  return {
    get: jest.fn((key: string) => {
      if (key === 'meta') {
        return {
          graphApiVersion: 'v21.0',
          oauthRedirectUri: 'http://localhost:3000/api/instagram/oauth/callback',
          instagramAppId: 'test-app-id',
          instagramAppSecret: 'test-app-secret',
        };
      }
      if (key === 'security') {
        return { tokenEncryptionKey: TOKEN_ENCRYPTION_KEY };
      }
      throw new Error(`unexpected config key: ${key}`);
    }),
  } as any;
}

describe('InstagramService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('findAccountsNeedingTokenRefresh', () => {
    it('returns ids of active accounts expiring within the refresh window', async () => {
      const prisma = {
        instagramAccount: {
          findMany: jest.fn().mockResolvedValue([{ id: 'acc-1' }, { id: 'acc-2' }]),
        },
      } as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      const ids = await service.findAccountsNeedingTokenRefresh();

      expect(ids).toEqual(['acc-1', 'acc-2']);
      expect(prisma.instagramAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: InstagramAccountStatus.ACTIVE }),
        }),
      );
    });
  });

  describe('refreshAccountToken', () => {
    it('does nothing when the account no longer exists', async () => {
      const prisma = {
        instagramAccount: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      } as any;
      global.fetch = jest.fn() as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      await service.refreshAccountToken('missing-account');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.instagramAccount.update).not.toHaveBeenCalled();
    });

    it('stores the refreshed token and new expiry on success', async () => {
      const encryptedCurrentToken = encryptSecret('current-token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue({ encryptedAccessToken: encryptedCurrentToken }),
          update: jest.fn().mockResolvedValue({}),
        },
      } as any;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-token', token_type: 'bearer', expires_in: 5184000 }),
      }) as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      await service.refreshAccountToken('acc-1');

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('grant_type=ig_refresh_token'));

      const call = prisma.instagramAccount.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'acc-1' });
      expect(call.data.tokenExpiresAt).toBeInstanceOf(Date);
      // decrypts back to the value the (mocked) API returned
      expect(service.decryptToken(call.data.encryptedAccessToken)).toEqual('new-token');
    });

    it('marks the account TOKEN_EXPIRED when Meta rejects the refresh', async () => {
      const encryptedCurrentToken = encryptSecret('current-token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue({ encryptedAccessToken: encryptedCurrentToken }),
          update: jest.fn().mockResolvedValue({}),
        },
      } as any;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid token',
      }) as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      await service.refreshAccountToken('acc-1');

      expect(prisma.instagramAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { status: InstagramAccountStatus.TOKEN_EXPIRED },
      });
    });
  });

  describe('listRecentMedia', () => {
    it('maps the Graph API media list to RecentMediaItem, preferring thumbnail_url over media_url', async () => {
      const encryptedToken = encryptSecret('token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ encryptedAccessToken: encryptedToken, igBusinessId: 'ig-user-1', status: InstagramAccountStatus.ACTIVE }),
        },
      } as any;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'media-1',
              caption: 'Hello world',
              media_type: 'VIDEO',
              media_url: 'https://example.com/video.mp4',
              thumbnail_url: 'https://example.com/thumb.jpg',
              permalink: 'https://instagram.com/p/media-1',
              timestamp: '2026-01-01T00:00:00+0000',
            },
            {
              id: 'media-2',
              media_type: 'IMAGE',
              media_url: 'https://example.com/image.jpg',
              permalink: 'https://instagram.com/p/media-2',
              timestamp: '2026-01-02T00:00:00+0000',
            },
          ],
        }),
      }) as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      const media = await service.listRecentMedia('acc-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://graph.instagram.com/v21.0/ig-user-1/media?'),
      );
      expect(media).toEqual([
        {
          id: 'media-1',
          caption: 'Hello world',
          mediaType: 'VIDEO',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          permalink: 'https://instagram.com/p/media-1',
          timestamp: '2026-01-01T00:00:00+0000',
        },
        {
          id: 'media-2',
          caption: null,
          mediaType: 'IMAGE',
          thumbnailUrl: 'https://example.com/image.jpg',
          permalink: 'https://instagram.com/p/media-2',
          timestamp: '2026-01-02T00:00:00+0000',
        },
      ]);
    });

    it('returns an empty list instead of throwing when the account has no usable credentials', async () => {
      const prisma = { instagramAccount: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      global.fetch = jest.fn() as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      const media = await service.listRecentMedia('missing-account');

      expect(media).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns an empty list instead of throwing on a Graph API error', async () => {
      const encryptedToken = encryptSecret('token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ encryptedAccessToken: encryptedToken, igBusinessId: 'ig-user-1', status: InstagramAccountStatus.ACTIVE }),
        },
      } as any;
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' }) as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      const media = await service.listRecentMedia('acc-1');

      expect(media).toEqual([]);
    });
  });

  describe('findAccountIdByIgUserId', () => {
    it('resolves an active account by its igUserId (the webhook entry.id), not igBusinessId', async () => {
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', status: InstagramAccountStatus.ACTIVE }),
        },
      } as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      const result = await service.findAccountIdByIgUserId('igsid-123');

      expect(result).toBe('acc-1');
      expect(prisma.instagramAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { igUserId: 'igsid-123' } }),
      );
    });

    it('returns null for a disconnected account', async () => {
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', status: InstagramAccountStatus.DISCONNECTED }),
        },
      } as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      expect(await service.findAccountIdByIgUserId('igsid-123')).toBeNull();
    });

    it('returns null when no account has that igUserId', async () => {
      const prisma = {
        instagramAccount: { findUnique: jest.fn().mockResolvedValue(null) },
      } as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      expect(await service.findAccountIdByIgUserId('igsid-unknown')).toBeNull();
    });
  });

  describe('handleCallback', () => {
    it('stores igBusinessId (profile.id) and igUserId (profile.user_id) as distinct values', async () => {
      // Regression test for the bug where webhooks stopped matching any
      // connected account: Instagram Login's /me `id` field (used for
      // outbound Graph API calls) is NOT the same ID Meta puts in webhook
      // entry.id - that's the separate `user_id` field, which must be
      // requested explicitly and stored separately. See schema.prisma.
      const redis = {
        get: jest.fn().mockResolvedValue('workspace-1'),
        del: jest.fn(),
      } as any;
      const prisma = {
        instagramAccount: {
          upsert: jest.fn().mockResolvedValue({
            id: 'acc-1',
            igUsername: 'orincore.official',
            accountType: 'BUSINESS',
            status: InstagramAccountStatus.ACTIVE,
            connectedAt: new Date(),
          }),
        },
      } as any;

      global.fetch = jest
        .fn()
        // exchangeCodeForShortLivedToken
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'short-lived', user_id: 'app-scoped-1' }),
        })
        // exchangeForLongLivedToken
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'long-lived', token_type: 'bearer', expires_in: 5184000 }),
        })
        // fetchProfile
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'app-scoped-profile-id',
            user_id: 'webhook-facing-user-id',
            username: 'orincore.official',
            account_type: 'BUSINESS',
          }),
        })
        // subscribeToWebhooks
        .mockResolvedValueOnce({ ok: true, text: async () => '' }) as any;

      const service = new InstagramService(prisma, makeConfigService(), redis);
      await service.handleCallback('auth-code', 'state-token');

      expect(prisma.instagramAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            igBusinessId: 'app-scoped-profile-id',
            igUserId: 'webhook-facing-user-id',
          }),
          update: expect.objectContaining({
            igUserId: 'webhook-facing-user-id',
          }),
        }),
      );
      // The two IDs must never collapse to the same value - that's exactly
      // the bug this test guards against.
      const call = prisma.instagramAccount.upsert.mock.calls[0][0];
      expect(call.create.igBusinessId).not.toBe(call.create.igUserId);

      // Regression guard: selecting "Live comment" as a trigger source in
      // the automation builder silently did nothing until accounts were
      // subscribed to Meta's live_comments webhook field.
      const subscribeCallUrl = (global.fetch as jest.Mock).mock.calls[3][0] as string;
      expect(subscribeCallUrl).toContain('subscribed_apps');
      expect(decodeURIComponent(subscribeCallUrl)).toContain('subscribed_fields=comments,live_comments,messages');
    });
  });
});
