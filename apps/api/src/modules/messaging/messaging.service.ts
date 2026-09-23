import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { ActionType, MessageLogStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { InstagramService } from '../instagram/instagram.service';
import { RateLimiterService } from './rate-limiter.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { MessageSendJobData } from '../../queues/processors/message-send.processor';

interface ActionContent {
  text: string;
  buttons?: { title: string; url: string }[];
}

class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

/**
 * Owns every outbound Instagram Graph API call for sends — CLAUDE.md §3 rule
 * 4: "no other module calls the Graph API directly." Orchestrates the
 * circuit breaker, rate limiter, the actual send, and MessageLog persistence
 * per attempt (ARCHITECTURE.md §5).
 *
 * Endpoints confirmed against Meta's current docs (developers.facebook.com/
 * documentation/instagram-platform/private-replies and
 * .../instagram-api-with-instagram-login/comment-moderation) rather than
 * assumed — this project has a documented history (TRACKER.md, Phase 1) of
 * getting Graph API specifics wrong when guessed instead of checked.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly instagramService: InstagramService,
    private readonly rateLimiter: RateLimiterService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async send(job: Job<MessageSendJobData>): Promise<void> {
    const data = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;

    if (await this.circuitBreaker.isOpen(data.instagramAccountId)) {
      await this.recordLog(data, attempt, MessageLogStatus.RATE_LIMITED, null, 'CIRCUIT_OPEN');
      throw new Error(
        `Circuit open for Instagram account ${data.instagramAccountId} — will be retried by the DLQ requeue scan once it closes`,
      );
    }

    const rateLimit = await this.rateLimiter.tryConsume(data.instagramAccountId);
    if (!rateLimit.allowed) {
      await this.recordLog(data, attempt, MessageLogStatus.RATE_LIMITED, null, 'RATE_LIMIT_EXCEEDED');
      throw new Error(
        `Rate limit exceeded for Instagram account ${data.instagramAccountId}, resets in ${rateLimit.retryAfterSeconds}s`,
      );
    }

    const credentials = await this.instagramService.getSendCredentials(data.instagramAccountId);
    if (!credentials) {
      // Disconnected/missing account — nothing a retry can fix.
      await this.recordLog(data, attempt, MessageLogStatus.FAILED, null, 'INSTAGRAM_ACCOUNT_UNAVAILABLE');
      return;
    }

    try {
      const response = await this.callGraphApi(data, credentials);
      await this.recordLog(data, attempt, MessageLogStatus.SENT, response, null);
      await this.circuitBreaker.recordSuccess(data.instagramAccountId);
    } catch (err) {
      await this.circuitBreaker.recordFailure(data.instagramAccountId);
      const graphError = err instanceof GraphApiError ? err : null;
      await this.recordLog(
        data,
        attempt,
        graphError?.status === 429 ? MessageLogStatus.RATE_LIMITED : MessageLogStatus.FAILED,
        graphError?.body ?? null,
        graphError?.message ?? (err as Error).message,
      );

      // GraphApiError means Meta's server actually received and responded
      // to this request — for a non-idempotent, customer-facing send
      // (REPLY_COMMENT/SEND_DM each create a new reply/message every call,
      // there's no dedup on Meta's side), retrying on anything but an
      // explicit 429 risks posting a duplicate if Meta's write actually
      // completed despite the error response. Confirmed happening in
      // production 2026-09-24: a REPLY_COMMENT posted 5 real times after
      // Meta returned "500 {code:1, message: 'An unknown error has
      // occurred'}" on every one of 5 automatic BullMQ retries — Meta's
      // own error was ambiguous, not a clean rejection. Only 429
      // (explicitly "not processed, rate limited") and true network-level
      // failures (err is not a GraphApiError — fetch() itself never got a
      // response, so nothing could have reached Meta) are safe to let
      // BullMQ retry; every other Graph API response stops here instead —
      // recorded as FAILED (visible in Activity for manual follow-up), not
      // silently lost, but never blindly re-sent.
      if (graphError && graphError.status !== 429) {
        return;
      }
      throw err; // BullMQ retries with backoff; DLQ requeue scan picks it up after that's exhausted
    }
  }

  private async callGraphApi(
    data: MessageSendJobData,
    credentials: { accessToken: string; igBusinessId: string },
  ): Promise<unknown> {
    const version = this.configService.get('meta', { infer: true }).graphApiVersion;
    const text = this.renderContentText(data.content as unknown as ActionContent);

    if (data.actionType === ActionType.SEND_DM) {
      if (data.recipientType === 'comment') {
        // Private reply. Meta's own constraints (confirmed via live docs):
        // only one message can be sent to a given commenter, and only
        // within 7 days of the comment — a second attempt after success
        // will just fail on Meta's side, which is expected, not a bug here.
        return this.postGraphApi(
          `${credentials.igBusinessId}/messages`,
          { recipient: { comment_id: data.recipientId }, message: { text } },
          credentials.accessToken,
          version,
        );
      }
      // Conversation-sourced (story reply / DM): replying into an existing
      // messaging thread uses a plain user ID, not a comment_id — a
      // different request shape than the private-reply case above (also
      // confirmed via live docs, not assumed). Meta only allows this within
      // a 24h window of the user's last message.
      return this.postGraphApi(
        `${credentials.igBusinessId}/messages`,
        { recipient: { id: data.recipientId }, message: { text } },
        credentials.accessToken,
        version,
      );
    }

    if (data.actionType === ActionType.REPLY_COMMENT) {
      if (data.recipientType !== 'comment') {
        // AutomationsService.dispatchAction already filters this combination
        // out before enqueueing — this is a defense-in-depth guard, not the
        // primary check.
        throw new Error('REPLY_COMMENT requires a comment-sourced event, not a conversation-sourced one');
      }
      return this.postGraphApi(`${data.recipientId}/replies`, { message: text }, credentials.accessToken, version);
    }

    if (data.actionType === ActionType.HIDE_COMMENT) {
      if (data.recipientType !== 'comment') {
        throw new Error('HIDE_COMMENT requires a comment-sourced event, not a conversation-sourced one');
      }
      // Comment Moderation: POST /<IG_COMMENT_ID>?hide=true — a query
      // param, not a JSON body field (confirmed against Meta's current
      // ig-comment reference docs). No text content of its own.
      return this.postGraphApi(`${data.recipientId}?hide=true`, {}, credentials.accessToken, version);
    }

    // SEND_AI_REPLY never reaches here — AutomationsService routes it to the
    // AI processing queue instead (see dispatchAction).
    throw new Error(`MessagingService cannot send actionType ${data.actionType}`);
  }

  private renderContentText(content: ActionContent): string {
    if (!content.buttons?.length) {
      return content.text;
    }
    // A generic button/link template's exact request shape for this
    // endpoint isn't verified against Meta's current docs — appending links
    // as plain text is a safe, always-correct fallback instead of guessing.
    const links = content.buttons.map((b) => `${b.title}: ${b.url}`).join('\n');
    return `${content.text}\n\n${links}`;
  }

  private async postGraphApi(path: string, body: unknown, accessToken: string, version: string): Promise<unknown> {
    const res = await fetch(`https://graph.instagram.com/${version}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } })?.error?.message ?? `Graph API request failed (${res.status})`;
      this.logger.error(`Graph API send failed: ${res.status} ${JSON.stringify(json)}`);
      throw new GraphApiError(message, res.status, json);
    }
    return json;
  }

  private async recordLog(
    data: MessageSendJobData,
    attempt: number,
    status: MessageLogStatus,
    graphApiResponse: unknown,
    errorCode: string | null,
  ): Promise<void> {
    await this.prisma.messageLog.create({
      data: {
        workspaceId: data.workspaceId,
        instagramAccountId: data.instagramAccountId,
        commentEventId: data.commentEventId,
        actionType: data.actionType,
        recipientId: data.recipientId,
        content: data.content as unknown as object,
        status,
        attempt,
        graphApiResponse: graphApiResponse as unknown as object,
        errorCode: errorCode ?? undefined,
        sentAt: status === MessageLogStatus.SENT ? new Date() : undefined,
      },
    });
  }
}
