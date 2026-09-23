import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { AppConfig } from '../../config/configuration';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { QueueName } from '../../queues/constants';
import { WebhookEventJobData } from '../../queues/processors/webhook-events.processor';
import { PostbackEventJobData } from '../../queues/processors/postback-events.processor';

const DEDUP_TTL_SECONDS = 24 * 60 * 60; // Meta may redeliver well within a day

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(QueueName.WEBHOOK_EVENTS) private readonly webhookQueue: Queue<WebhookEventJobData>,
    @InjectQueue(QueueName.POSTBACK_EVENTS) private readonly postbackQueue: Queue<PostbackEventJobData>,
  ) {}

  /** Meta's GET verification handshake when subscribing the webhook URL. */
  verifySubscription(mode: string, token: string, challenge: string): string | null {
    const expectedToken = this.configService.get('meta', { infer: true }).webhookVerifyToken;
    if (mode === 'subscribe' && timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies X-Hub-Signature-256 against the raw request body. Every
   * account connects via Business Login for Instagram (graph.instagram.com
   * — see InstagramService), a separate Meta app from the main one, so Meta
   * signs these webhook deliveries with META_INSTAGRAM_APP_SECRET, not the
   * main app's META_APP_SECRET. CLAUDE.md §5: every webhook request is
   * signature-verified before the payload is trusted or enqueued.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader?.startsWith('sha256=')) {
      return false;
    }

    const meta = this.configService.get('meta', { infer: true });
    const appSecret = meta.instagramAppSecret ?? meta.appSecret;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.slice('sha256='.length);

    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Dedup + enqueue. Returns false if this event was already seen (Meta
   * redelivery or genuine duplicate), so the caller can skip enqueueing.
   * CLAUDE.md §3 rule 3: idempotent processing via Redis SETNX + TTL, with
   * the CommentEvent.externalEventId unique constraint as a Postgres-level
   * backstop applied later by the processor.
   */
  async enqueueIfNew(event: WebhookEventJobData): Promise<boolean> {
    const dedupKey = `webhook:dedup:${event.externalEventId}`;
    const isNew = await this.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');

    if (!isNew) {
      this.logger.debug(`Duplicate webhook event ignored: ${event.externalEventId}`);
      return false;
    }

    try {
      await this.webhookQueue.add('process-event', event, {
        // BullMQ 5.x rejects an all-digit custom job id ("Custom Id cannot
        // be integers") - Meta's event ids are always numeric strings, so a
        // bare externalEventId crashed every single webhook delivery. The
        // "webhook-" prefix keeps this a stable, dedup-safe jobId without
        // tripping that check.
        jobId: `webhook-${event.externalEventId}`,
      });
    } catch (err) {
      // The dedup key above is otherwise a permanent blackhole: if the
      // enqueue itself fails, Meta's retry of the same event would see
      // "already seen" and never actually queue it. Clear it so a retry
      // (or the same request failing transiently) gets a real second try.
      await this.redis.del(dedupKey);
      throw err;
    }
    return true;
  }

  /** Same dedup+enqueue shape as enqueueIfNew, keyed off the postback's own message id instead of a CommentEvent's externalEventId. */
  async enqueuePostbackIfNew(event: PostbackEventJobData): Promise<boolean> {
    const dedupKey = `webhook:dedup:postback:${event.mid}`;
    const isNew = await this.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');

    if (!isNew) {
      this.logger.debug(`Duplicate postback event ignored: ${event.mid}`);
      return false;
    }

    try {
      await this.postbackQueue.add('process-postback', event, { jobId: `postback-webhook-${event.mid}` });
    } catch (err) {
      await this.redis.del(dedupKey);
      throw err;
    }
    return true;
  }
}
