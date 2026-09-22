import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { InstagramService } from '../instagram/instagram.service';
import { WebhooksService } from './webhooks.service';
import { MetaWebhookPayload } from './dto/meta-webhook-payload.dto';
import { WebhookEventJobData } from '../../queues/processors/webhook-events.processor';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks/instagram')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly instagramService: InstagramService,
  ) {}

  /** Meta's one-time subscription verification handshake. */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const result = this.webhooksService.verifySubscription(mode, token, challenge);
    if (result === null) {
      throw new BadRequestException('Webhook verification failed');
    }
    return result;
  }

  /** Receives real-time comment/DM/mention events. Must return fast — see ARCHITECTURE.md §1. */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: RawBodyRequest,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ status: string }> {
    if (!req.rawBody || !this.webhooksService.verifySignature(req.rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = req.body as MetaWebhookPayload;
    if (payload.object !== 'instagram') {
      return { status: 'ignored' };
    }

    for (const entry of payload.entry ?? []) {
      const instagramAccountId = await this.instagramService.findAccountIdByIgUserId(entry.id);
      if (!instagramAccountId) {
        this.logger.warn(`Webhook for unknown/disconnected IG account: ${entry.id}`);
        continue;
      }

      for (const change of entry.changes ?? []) {
        const jobData = this.mapChangeToJobData(change, instagramAccountId);
        if (jobData) {
          await this.webhooksService.enqueueIfNew(jobData);
        }
      }

      for (const messagingEvent of entry.messaging ?? []) {
        const jobData = this.mapMessagingEventToJobData(messagingEvent, instagramAccountId);
        if (jobData) {
          await this.webhooksService.enqueueIfNew(jobData);
        }
      }
    }

    return { status: 'accepted' };
  }

  private mapChangeToJobData(
    change: NonNullable<MetaWebhookPayload['entry'][number]['changes']>[number],
    instagramAccountId: string,
  ): WebhookEventJobData | null {
    if (!change.value.id || !change.value.from) {
      return null;
    }

    const source = change.field === 'live_comments' ? 'LIVE_COMMENT' : 'COMMENT';

    return {
      externalEventId: change.value.id,
      instagramAccountId,
      source,
      mediaId: change.value.media?.id,
      fromUsername: change.value.from.username,
      text: change.value.text ?? '',
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Only story replies are handled here — plain DMs (`message` with no
   * `reply_to.story`) are intentionally skipped until DM automations are
   * actually requested and their own recipient handling is designed.
   *
   * `fromUsername` is set to the sender's IG-scoped user ID, not a real
   * username: unlike comments, this webhook payload doesn't include one,
   * and resolving it would mean an extra Graph API call on every incoming
   * message. Known simplification, flagged in TRACKER.md — the
   * `{{username}}` template will show a numeric ID for story-reply-
   * triggered actions, not a handle. This same field doubles as the
   * outbound recipient ID for the reply (see AutomationsService.dispatchAction
   * and MessagingService — a story reply must be answered via
   * `{ recipient: { id } }`, not `{ recipient: { comment_id } }`).
   */
  private mapMessagingEventToJobData(
    event: NonNullable<MetaWebhookPayload['entry'][number]['messaging']>[number],
    instagramAccountId: string,
  ): WebhookEventJobData | null {
    if (!event.message?.mid || !event.message.reply_to?.story) {
      return null;
    }

    return {
      externalEventId: event.message.mid,
      instagramAccountId,
      source: 'STORY_REPLY',
      fromUsername: event.sender.id,
      text: event.message.text ?? '',
      receivedAt: new Date(event.timestamp * 1000).toISOString(),
    };
  }
}
