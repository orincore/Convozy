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

  describe('disconnectAccount', () => {
    it('marks the account DISCONNECTED and stamps disconnectedAt when it belongs to the caller workspace', async () => {
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1' }),
          update: jest.fn().mockResolvedValue({}),
        },
      } as any;
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      await service.disconnectAccount('workspace-1', 'acc-1');

      expect(prisma.instagramAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { status: InstagramAccountStatus.DISCONNECTED, disconnectedAt: expect.any(Date) },
      });
    });

    it('404s rather than disconnecting an account owned by another workspace', async () => {
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue({ workspaceId: 'someone-elses-workspace' }),
          update: jest.fn(),
        },
      } as any;
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      await expect(service.disconnectAccount('workspace-1', 'acc-1')).rejects.toThrow();
      expect(prisma.instagramAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('listAccounts', () => {
    it('excludes DISCONNECTED accounts so an unlinked account actually disappears from the list', async () => {
      const prisma = { instagramAccount: { findMany: jest.fn().mockResolvedValue([]) } } as any;
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      await service.listAccounts('workspace-1');

      expect(prisma.instagramAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'workspace-1', status: { not: InstagramAccountStatus.DISCONNECTED } },
        }),
      );
    });
  });

  describe('getSendCredentials', () => {
    it('returns credentials for an ACTIVE account', async () => {
      const encryptedToken = encryptSecret('real-token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ encryptedAccessToken: encryptedToken, igBusinessId: 'ig-biz-1', status: InstagramAccountStatus.ACTIVE }),
        },
      } as any;
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      const creds = await service.getSendCredentials('acc-1');

      expect(creds).toEqual({ accessToken: 'real-token', igBusinessId: 'ig-biz-1' });
    });

    it('returns credentials for a RATE_LIMITED account — regression test for the permanent-lockout bug', async () => {
      // Previously RATE_LIMITED was blocked here too, which meant a send
      // could never reach the messaging pipeline again to trigger
      // CircuitBreakerService.recordSuccess, which is the only thing that
      // resets status back to ACTIVE — a real account got permanently stuck
      // 2026-09-23. RATE_LIMITED is meant to be temporary/self-healing;
      // CircuitBreakerService.isOpen() is what actually gates sends during
      // the open window, not this method.
      const encryptedToken = encryptSecret('real-token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ encryptedAccessToken: encryptedToken, igBusinessId: 'ig-biz-1', status: InstagramAccountStatus.RATE_LIMITED }),
        },
      } as any;
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      const creds = await service.getSendCredentials('acc-1');

      expect(creds).toEqual({ accessToken: 'real-token', igBusinessId: 'ig-biz-1' });
    });

    it.each([InstagramAccountStatus.DISCONNECTED, InstagramAccountStatus.TOKEN_EXPIRED, InstagramAccountStatus.ERROR])(
      'returns null for a %s account',
      async (status) => {
        const prisma = {
          instagramAccount: {
            findUnique: jest.fn().mockResolvedValue({ encryptedAccessToken: 'x', igBusinessId: 'ig-biz-1', status }),
          },
        } as any;
        const service = new InstagramService(prisma, makeConfigService(), {} as any);

        expect(await service.getSendCredentials('acc-1')).toBeNull();
      },
    );

    it('returns null when the account does not exist', async () => {
      const prisma = { instagramAccount: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      expect(await service.getSendCredentials('missing')).toBeNull();
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

  describe('isOwnAccountComment', () => {
    // Regression tests for a real production incident (2026-09-24): a
    // REPLY_COMMENT automation replied to its own reply forever because
    // nothing recognized the reply Meta re-delivered as a webhook event was
    // authored by the connected account itself.
    function makeAccountPrisma(account: Record<string, unknown> | null) {
      return { instagramAccount: { findUnique: jest.fn().mockResolvedValue(account) } } as any;
    }

    it('matches by id against igBusinessId', async () => {
      const prisma = makeAccountPrisma({ igBusinessId: 'biz-1', igUserId: 'user-1', igUsername: 'ig_orincore' });
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      expect(await service.isOwnAccountComment('acc-1', { id: 'biz-1' })).toBe(true);
    });

    it('matches by id against igUserId', async () => {
      const prisma = makeAccountPrisma({ igBusinessId: 'biz-1', igUserId: 'user-1', igUsername: 'ig_orincore' });
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      expect(await service.isOwnAccountComment('acc-1', { id: 'user-1' })).toBe(true);
    });

    it('matches by username case-insensitively when no id is present (the exact incident payload)', async () => {
      const prisma = makeAccountPrisma({ igBusinessId: 'biz-1', igUserId: 'user-1', igUsername: 'ig_orincore' });
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      expect(await service.isOwnAccountComment('acc-1', { username: 'IG_Orincore' })).toBe(true);
    });

    it('returns false for a real viewer', async () => {
      const prisma = makeAccountPrisma({ igBusinessId: 'biz-1', igUserId: 'user-1', igUsername: 'ig_orincore' });
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      expect(await service.isOwnAccountComment('acc-1', { id: 'viewer-1', username: 'a_real_viewer' })).toBe(false);
    });

    it('returns false when the account no longer exists', async () => {
      const prisma = makeAccountPrisma(null);
      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      expect(await service.isOwnAccountComment('acc-1', { id: 'anything' })).toBe(false);
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

    it('caches the profile preview fields (name, picture, follower count) at connect time', async () => {
      const redis = { get: jest.fn().mockResolvedValue('workspace-1'), del: jest.fn() } as any;
      const prisma = { instagramAccount: { upsert: jest.fn().mockResolvedValue({}) } } as any;

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'short-lived', user_id: 'x' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'long-lived', token_type: 'bearer', expires_in: 5184000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'profile-id',
            user_id: 'user-id',
            username: 'orincore.official',
            account_type: 'BUSINESS',
            name: 'Orincore Official',
            profile_picture_url: 'https://cdn.example/pic.jpg',
            followers_count: 4821,
          }),
        })
        .mockResolvedValueOnce({ ok: true, text: async () => '' }) as any;

      const service = new InstagramService(prisma, makeConfigService(), redis);
      await service.handleCallback('auth-code', 'state-token');

      expect(prisma.instagramAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            displayName: 'Orincore Official',
            profilePictureUrl: 'https://cdn.example/pic.jpg',
            followersCount: 4821,
            profileSyncedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('syncProfile', () => {
    it('fetches and caches fresh profile fields for an account with valid credentials', async () => {
      const encryptedToken = encryptSecret('real-token', TOKEN_ENCRYPTION_KEY);
      const prisma = {
        instagramAccount: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ encryptedAccessToken: encryptedToken, igBusinessId: 'ig-biz-1', status: InstagramAccountStatus.ACTIVE }),
          update: jest.fn().mockResolvedValue({}),
        },
      } as any;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'ig-biz-1',
          user_id: 'user-id',
          username: 'orincore.official',
          account_type: 'BUSINESS',
          name: 'Orincore Official',
          profile_picture_url: 'https://cdn.example/pic2.jpg',
          followers_count: 5000,
        }),
      }) as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);
      await service.syncProfile('acc-1');

      expect(prisma.instagramAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: expect.objectContaining({
            displayName: 'Orincore Official',
            profilePictureUrl: 'https://cdn.example/pic2.jpg',
            followersCount: 5000,
          }),
        }),
      );
    });

    it('throws instead of pinging Meta when the account has no usable credentials', async () => {
      const prisma = {
        instagramAccount: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      } as any;
      global.fetch = jest.fn() as any;

      const service = new InstagramService(prisma, makeConfigService(), {} as any);

      await expect(service.syncProfile('missing-acc')).rejects.toThrow();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
