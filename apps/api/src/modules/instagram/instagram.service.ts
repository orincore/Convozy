import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { InstagramAccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AppException, NotFoundAppException } from '../../common/utils/app-exception';
import { encryptSecret, decryptSecret } from '../../common/utils/crypto.util';

const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes to complete the consent flow
const OAUTH_STATE_KEY_PREFIX = 'instagram:oauth:state:';

// Refresh long-lived tokens once they're within this window of expiring.
// Meta requires the token be at least 24h old before it's refreshable, and
// long-lived tokens last ~60 days, so a 7-day window leaves ample retry room.
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Confirmed via Meta's current docs (developers.facebook.com/docs/instagram-platform/webhooks):
// "comments", "live_comments", and "messages" are the exact field names Meta
// expects on POST /{ig-user-id}/subscribed_apps. "live_comments" notifies on
// comments made during a live video and needs the same permissions already
// granted for "comments" (instagram_business_basic +
// instagram_business_manage_comments) — no extra OAuth scope required.
const WEBHOOK_SUBSCRIBED_FIELDS = 'comments,live_comments,messages';

// Business Login for Instagram (docs: developers.facebook.com/documentation/
// instagram-platform/instagram-api-with-instagram-login/business-login).
// Confirmed via Meta's current docs (pulled live, not assumed):
// "This API setup does not require a Facebook Page to be linked to the
// Instagram professional account." Uses its OWN Instagram App ID/Secret,
// distinct from the main Meta App ID used for webhook signing - found at
// App Dashboard > Instagram > "API setup with Instagram login" >
// 3. Set up Instagram business login > Business login settings. See
// TRACKER.md "Meta App audit" for the full diagnosis trail (we tried the
// Facebook-Page-linked flow first by mistake, then confirmed this one via
// Meta's official docs through the meta_social_technologies MCP + direct
// doc search).
const OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
].join(',');

interface ShortLivedTokenResponse {
  access_token: string;
  user_id: string;
  permissions?: string;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
}

interface InstagramProfileResponse {
  id: string;
  // The Instagram-scoped user ID - distinct from `id` above, and the value
  // Meta actually sends in webhook payloads' entry.id. Must be explicitly
  // requested via `fields` or Meta omits it. See findAccountIdByIgUserId.
  user_id: string;
  username: string;
  account_type: string;
  name?: string;
  // Preview fields (Milestone: Accounts page profile preview + caching).
  // Confirmed against Meta's current IG User/Business-Login field reference
  // — both available under the already-granted instagram_business_basic
  // scope, no extra permission needed.
  profile_picture_url?: string;
  followers_count?: number;
}

export interface ConnectedAccountSummary {
  id: string;
  igUsername: string;
  accountType: string | null;
  status: InstagramAccountStatus;
  connectedAt: Date;
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  profileSyncedAt: Date | null;
}

interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

export interface RecentMediaItem {
  id: string;
  caption: string | null;
  mediaType: InstagramMediaItem['media_type'];
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Resolves Meta's webhook `entry.id` (the Instagram-scoped user ID, NOT
   * the same as igBusinessId - see schema.prisma) to our internal
   * InstagramAccount.id. Used by the webhooks module so it never has to
   * query InstagramAccount directly (CLAUDE.md §3 module boundary rule).
   */
  async findAccountIdByIgUserId(igUserId: string): Promise<string | null> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { igUserId },
      select: { id: true, status: true },
    });

    if (!account || account.status === InstagramAccountStatus.DISCONNECTED) {
      return null;
    }
    return account.id;
  }

  /**
   * Real production incident, 2026-09-24: a REPLY_COMMENT automation with
   * an unconditional (empty-keyword) trigger replied to its own reply,
   * which Meta's `comments`/`live_comments` webhook legitimately
   * re-delivers as a fresh comment authored by the connected account
   * itself — creating an infinite public reply loop (a new comment every
   * ~3-4s). Nothing previously distinguished "a real viewer commented"
   * from "the account's own automated reply came back as a webhook event."
   * Called by WebhooksController before enqueueing any COMMENT/LIVE_COMMENT
   * event, so a self-authored comment never reaches matching/dispatch at
   * all — this is a structural guard, not something a trigger/condition
   * author can misconfigure their way around.
   */
  async isOwnAccountComment(instagramAccountId: string, from: { id?: string; username?: string }): Promise<boolean> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { igBusinessId: true, igUserId: true, igUsername: true },
    });
    if (!account) {
      return false;
    }
    if (from.id && (from.id === account.igBusinessId || from.id === account.igUserId)) {
      return true;
    }
    return !!from.username && from.username.toLowerCase() === account.igUsername.toLowerCase();
  }

  /**
   * Used by other modules (e.g. automations) to check an InstagramAccount
   * belongs to the caller's workspace before referencing it, without those
   * modules querying InstagramAccount directly — CLAUDE.md §3 rule 1.
   */
  async accountBelongsToWorkspace(instagramAccountId: string, workspaceId: string): Promise<boolean> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { workspaceId: true },
    });
    return account?.workspaceId === workspaceId;
  }

  /**
   * Unlinks an account: marks it DISCONNECTED rather than deleting the row.
   * A hard delete would cascade-destroy every automation, comment event,
   * message log, and contact tied to it (schema.prisma onDelete: Cascade) —
   * real historical data a creator would not expect "disconnect" to erase.
   * DISCONNECTED accounts are excluded from listAccounts (so they actually
   * disappear from the Accounts page) and already blocked from sending by
   * getSendCredentials. Reconnecting the same Instagram account later
   * re-upserts by igBusinessId and clears this automatically.
   */
  async disconnectAccount(workspaceId: string, instagramAccountId: string): Promise<void> {
    if (!(await this.accountBelongsToWorkspace(instagramAccountId, workspaceId))) {
      throw new NotFoundAppException(
        'INSTAGRAM_ACCOUNT_NOT_FOUND',
        'This Instagram account was not found in your workspace.',
      );
    }
    await this.prisma.instagramAccount.update({
      where: { id: instagramAccountId },
      data: { status: InstagramAccountStatus.DISCONNECTED, disconnectedAt: new Date() },
    });
  }

  /**
   * Used by the messaging module to get what it needs for an outbound Graph
   * API call without querying InstagramAccount directly (CLAUDE.md §3 rule
   * 1). Returns null for a missing/disconnected/expired account so callers
   * can fail cleanly instead of sending with a stale token.
   *
   * RATE_LIMITED is deliberately NOT in this blocklist. It's a temporary,
   * self-healing state tracked primarily by CircuitBreakerService's Redis
   * key (isOpen() is what actually gates whether a send is attempted during
   * the open window — see MessagingService.send). Blocking credentials here
   * too created a permanent deadlock: once RATE_LIMITED, this always
   * returned null, so a send could never reach callGraphApi again, so
   * CircuitBreakerService.recordSuccess (the only thing that resets status
   * back to ACTIVE) could never run — the account was bricked forever after
   * 5 consecutive failures. Found live 2026-09-23 (@orincore.official stuck
   * on RATE_LIMITED with the circuit long since closed).
   */
  async getSendCredentials(
    instagramAccountId: string,
  ): Promise<{ accessToken: string; igBusinessId: string } | null> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { encryptedAccessToken: true, igBusinessId: true, status: true },
    });
    if (!account) {
      return null;
    }
    const blockedStatuses: InstagramAccountStatus[] = [
      InstagramAccountStatus.DISCONNECTED,
      InstagramAccountStatus.TOKEN_EXPIRED,
      InstagramAccountStatus.ERROR,
    ];
    if (blockedStatuses.includes(account.status)) {
      return null;
    }
    return { accessToken: this.decryptToken(account.encryptedAccessToken), igBusinessId: account.igBusinessId };
  }

  /**
   * Recent posts for the dashboard's "specific posts" automation scope
   * picker. Endpoint/fields confirmed against Meta's current docs for
   * Business Login for Instagram (graph.instagram.com, GET /{ig-user-id}/
   * media) rather than assumed — an earlier fetch of a generic Graph API doc
   * page mixed in graph.facebook.com / Page-linked-flow details that don't
   * apply to this app's flow, so the actual field list was re-verified
   * against a source specific to Instagram Business Login before writing
   * this.
   */
  async listRecentMedia(instagramAccountId: string): Promise<RecentMediaItem[]> {
    const credentials = await this.getSendCredentials(instagramAccountId);
    if (!credentials) {
      return [];
    }

    const meta = this.configService.get('meta', { infer: true });
    const params = new URLSearchParams({
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
      access_token: credentials.accessToken,
    });

    const res = await fetch(
      `https://graph.instagram.com/${meta.graphApiVersion}/${credentials.igBusinessId}/media?${params.toString()}`,
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Media list fetch failed for account ${instagramAccountId}: ${res.status} ${body}`);
      return [];
    }

    const { data } = (await res.json()) as { data: InstagramMediaItem[] };
    return data.map((item) => ({
      id: item.id,
      caption: item.caption ?? null,
      mediaType: item.media_type,
      thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
      permalink: item.permalink,
      timestamp: item.timestamp,
    }));
  }

  /** Used by the messaging module's DLQ requeue scan to skip permanently-broken accounts. */
  async isAccountActive(instagramAccountId: string): Promise<boolean> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { status: true },
    });
    return account?.status === InstagramAccountStatus.ACTIVE;
  }

  /** Used by the messaging module's circuit breaker to flag/clear an account's send-blocked state. */
  async setAccountStatus(instagramAccountId: string, status: InstagramAccountStatus): Promise<void> {
    await this.prisma.instagramAccount.updateMany({
      where: { id: instagramAccountId, status: { not: status } },
      data: { status },
    });
  }

  async listAccounts(workspaceId: string): Promise<ConnectedAccountSummary[]> {
    // Reads only — no Graph API call here. Profile preview fields are
    // populated at connect time and refreshed by refreshAccountToken's
    // periodic cycle (see syncProfile below), never fetched live on page
    // load. DISCONNECTED accounts are excluded — disconnectAccount marks
    // rather than deletes them (preserves automations/history), so "unlink"
    // has to be enforced here for the account to actually disappear from
    // the Accounts page.
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { workspaceId, status: { not: InstagramAccountStatus.DISCONNECTED } },
      select: {
        id: true,
        igUsername: true,
        accountType: true,
        status: true,
        connectedAt: true,
        displayName: true,
        profilePictureUrl: true,
        followersCount: true,
        profileSyncedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });
    return accounts;
  }

  /**
   * Starts the connect flow: stores a one-time state token mapped to the
   * requesting workspace (so the public callback route below knows who's
   * connecting, without needing the user's JWT on Instagram's redirect back
   * to us) and returns the authorize URL for the frontend to navigate to.
   */
  async createAuthorizationUrl(workspaceId: string): Promise<string> {
    const instagramAppId = this.requireInstagramAppId();

    const state = randomUUID();
    await this.redis.set(
      `${OAUTH_STATE_KEY_PREFIX}${state}`,
      workspaceId,
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );

    const meta = this.configService.get('meta', { infer: true });
    const params = new URLSearchParams({
      client_id: instagramAppId,
      redirect_uri: meta.oauthRedirectUri,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      state,
    });

    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Completes the connect flow from the callback: resolves the workspace
   * from `state`, exchanges the code for a short-lived then long-lived
   * Instagram User access token, fetches the account profile, and upserts
   * InstagramAccount with the token encrypted at rest (CLAUDE.md §5). No
   * Facebook Page involved anywhere in this flow.
   */
  async handleCallback(code: string, state: string): Promise<ConnectedAccountSummary> {
    const workspaceId = await this.consumeState(state);

    const shortLived = await this.exchangeCodeForShortLivedToken(code);
    const longLived = await this.exchangeForLongLivedToken(shortLived.access_token);
    const profile = await this.fetchProfile(longLived.access_token);

    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

    const now = new Date();
    const account = await this.prisma.instagramAccount.upsert({
      where: { igBusinessId: profile.id },
      create: {
        workspaceId,
        igBusinessId: profile.id,
        igUserId: profile.user_id,
        igUsername: profile.username,
        accountType: profile.account_type,
        displayName: profile.name ?? null,
        profilePictureUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
        profileSyncedAt: now,
        encryptedAccessToken: this.encryptToken(longLived.access_token),
        tokenExpiresAt: expiresAt,
        status: InstagramAccountStatus.ACTIVE,
      },
      update: {
        workspaceId,
        igUserId: profile.user_id,
        igUsername: profile.username,
        accountType: profile.account_type,
        displayName: profile.name ?? null,
        profilePictureUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
        profileSyncedAt: now,
        encryptedAccessToken: this.encryptToken(longLived.access_token),
        tokenExpiresAt: expiresAt,
        status: InstagramAccountStatus.ACTIVE,
        disconnectedAt: null,
      },
      select: {
        id: true,
        igUsername: true,
        accountType: true,
        status: true,
        connectedAt: true,
        displayName: true,
        profilePictureUrl: true,
        followersCount: true,
        profileSyncedAt: true,
      },
    });

    this.logger.log(`Instagram account @${profile.username} connected to workspace ${workspaceId}`);

    // Non-fatal: the account is connected either way. If this fails, the
    // account just won't receive webhooks until the next successful call —
    // logged for visibility rather than failing the whole connect flow.
    await this.subscribeToWebhooks(profile.id, longLived.access_token).catch((err) => {
      this.logger.error(`Webhook subscription threw for IG account ${profile.id}: ${(err as Error).message}`);
    });

    return account;
  }

  /**
   * Registers this app to receive webhook events for the given IG account.
   * Required per-account even after the App Dashboard's Webhooks product is
   * configured — see developers.facebook.com/docs/instagram-platform/webhooks.
   */
  private async subscribeToWebhooks(igUserId: string, accessToken: string): Promise<void> {
    const meta = this.configService.get('meta', { infer: true });
    const params = new URLSearchParams({
      subscribed_fields: WEBHOOK_SUBSCRIBED_FIELDS,
      access_token: accessToken,
    });

    const res = await fetch(
      `https://graph.instagram.com/${meta.graphApiVersion}/${igUserId}/subscribed_apps?${params.toString()}`,
      { method: 'POST' },
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Webhook subscription failed for IG account ${igUserId}: ${res.status} ${body}`);
      return;
    }

    this.logger.log(`Subscribed IG account ${igUserId} to webhook fields: ${WEBHOOK_SUBSCRIBED_FIELDS}`);
  }

  /** IDs of accounts whose long-lived token is due for renewal. Used by TokenRefreshProcessor. */
  async findAccountsNeedingTokenRefresh(): Promise<string[]> {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: {
        status: InstagramAccountStatus.ACTIVE,
        tokenExpiresAt: { lt: new Date(Date.now() + TOKEN_REFRESH_WINDOW_MS) },
      },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  /**
   * Refreshes a single account's long-lived token. Marks the account
   * TOKEN_EXPIRED (rather than throwing) if Meta rejects the refresh, since
   * that's a real account state the dashboard should be able to show —
   * throwing would just make TokenRefreshProcessor log-and-skip it anyway.
   */
  async refreshAccountToken(accountId: string): Promise<void> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { encryptedAccessToken: true },
    });
    if (!account) {
      return;
    }

    const currentToken = this.decryptToken(account.encryptedAccessToken);
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: currentToken,
    });

    const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Token refresh failed for account ${accountId}: ${res.status} ${body}`);
      await this.prisma.instagramAccount.update({
        where: { id: accountId },
        data: { status: InstagramAccountStatus.TOKEN_EXPIRED },
      });
      return;
    }

    const refreshed = (await res.json()) as LongLivedTokenResponse;
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    await this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        encryptedAccessToken: this.encryptToken(refreshed.access_token),
        tokenExpiresAt: expiresAt,
      },
    });

    this.logger.log(`Refreshed Instagram token for account ${accountId}, new expiry ${expiresAt.toISOString()}`);

    // Opportunistic, non-fatal: this job already holds a fresh token, so
    // it's a natural place to keep the cached profile preview (Accounts
    // page) from going stale over time without a dedicated polling job.
    await this.syncProfile(accountId).catch((err) => {
      this.logger.warn(`Profile sync after token refresh failed for account ${accountId}: ${(err as Error).message}`);
    });
  }

  /**
   * Re-fetches the profile preview fields (name, picture, follower count)
   * from Meta and caches them — the only place this ever hits the Graph API
   * live. Called at connect time (handleCallback), opportunistically after
   * a token refresh, and on-demand via the dashboard's "Refresh profile"
   * action (InstagramController) — never automatically on every page load.
   */
  async syncProfile(accountId: string): Promise<ConnectedAccountSummary> {
    const credentials = await this.getSendCredentials(accountId);
    if (!credentials) {
      throw new AppException(
        'INSTAGRAM_ACCOUNT_UNAVAILABLE',
        'This account needs to be reconnected before its profile can be refreshed.',
      );
    }

    const profile = await this.fetchProfile(credentials.accessToken);

    return this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        displayName: profile.name ?? null,
        profilePictureUrl: profile.profile_picture_url ?? null,
        followersCount: profile.followers_count ?? null,
        profileSyncedAt: new Date(),
      },
      select: {
        id: true,
        igUsername: true,
        accountType: true,
        status: true,
        connectedAt: true,
        displayName: true,
        profilePictureUrl: true,
        followersCount: true,
        profileSyncedAt: true,
      },
    });
  }

  private requireInstagramAppId(): string {
    const meta = this.configService.get('meta', { infer: true });
    if (!meta.instagramAppId) {
      throw new AppException(
        'INSTAGRAM_LOGIN_NOT_CONFIGURED',
        'META_INSTAGRAM_APP_ID is not set - find it under App Dashboard > Instagram > "API setup with Instagram login" > 3. Set up Instagram business login > Business login settings.',
      );
    }
    return meta.instagramAppId;
  }

  private requireInstagramAppSecret(): string {
    const meta = this.configService.get('meta', { infer: true });
    if (!meta.instagramAppSecret) {
      throw new AppException(
        'INSTAGRAM_LOGIN_NOT_CONFIGURED',
        'META_INSTAGRAM_APP_SECRET is not set - find it under App Dashboard > Instagram > "API setup with Instagram login" > 3. Set up Instagram business login > Business login settings.',
      );
    }
    return meta.instagramAppSecret;
  }

  private async consumeState(state: string): Promise<string> {
    const key = `${OAUTH_STATE_KEY_PREFIX}${state}`;
    const workspaceId = await this.redis.get(key);
    if (!workspaceId) {
      throw new AppException(
        'INSTAGRAM_OAUTH_STATE_INVALID',
        'This Instagram connection link expired or was already used. Start again from the dashboard.',
      );
    }
    await this.redis.del(key);
    return workspaceId;
  }

  private async exchangeCodeForShortLivedToken(code: string): Promise<ShortLivedTokenResponse> {
    const meta = this.configService.get('meta', { infer: true });
    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.requireInstagramAppId(),
        client_secret: this.requireInstagramAppSecret(),
        grant_type: 'authorization_code',
        redirect_uri: meta.oauthRedirectUri,
        code,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Instagram token exchange failed: ${res.status} ${body}`);
      throw new AppException(
        'INSTAGRAM_TOKEN_EXCHANGE_FAILED',
        'Instagram rejected the connection request. Please try connecting again.',
      );
    }

    return res.json() as Promise<ShortLivedTokenResponse>;
  }

  private async exchangeForLongLivedToken(shortLivedToken: string): Promise<LongLivedTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.requireInstagramAppSecret(),
      access_token: shortLivedToken,
    });

    const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Instagram long-lived token exchange failed: ${res.status} ${body}`);
      throw new AppException(
        'INSTAGRAM_TOKEN_EXCHANGE_FAILED',
        'Instagram rejected the connection request. Please try connecting again.',
      );
    }

    return res.json() as Promise<LongLivedTokenResponse>;
  }

  private async fetchProfile(accessToken: string): Promise<InstagramProfileResponse> {
    const meta = this.configService.get('meta', { infer: true });
    const params = new URLSearchParams({
      fields: 'id,user_id,username,account_type,name,profile_picture_url,followers_count',
      access_token: accessToken,
    });

    const res = await fetch(
      `https://graph.instagram.com/${meta.graphApiVersion}/me?${params.toString()}`,
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Instagram profile fetch failed: ${res.status} ${body}`);
      throw new AppException(
        'INSTAGRAM_PROFILE_FETCH_FAILED',
        'Connected to Instagram, but could not read the account profile.',
      );
    }

    return res.json() as Promise<InstagramProfileResponse>;
  }

  /** Encrypts a raw Graph API access token before persisting it. */
  private encryptToken(token: string): string {
    return encryptSecret(token, this.configService.get('security', { infer: true }).tokenEncryptionKey);
  }

  /** Decrypts a stored token for use in an outbound Graph API call. */
  decryptToken(encryptedToken: string): string {
    return decryptSecret(encryptedToken, this.configService.get('security', { infer: true }).tokenEncryptionKey);
  }
}
