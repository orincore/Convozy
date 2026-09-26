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
        // Structural self-loop guard (real incident, 2026-09-24): a
        // REPLY_COMMENT automation's own reply is legitimately re-delivered
        // by Meta as a fresh comment event authored by this same account —
        // without this check, a broadly-matching trigger replies to its own
        // reply forever. Checked before mapping/enqueueing, never reachable
        // by matching/dispatch at all. See InstagramService.isOwnAccountComment.
        if (change.value.from && (await this.instagramService.isOwnAccountComment(instagramAccountId, change.value.from))) {
          this.logger.debug(`Dropping self-authored comment ${change.value.id} on account ${instagramAccountId}`);
          continue;
        }
        const jobData = this.mapChangeToJobData(change, instagramAccountId);
        if (jobData) {
          await this.webhooksService.enqueueIfNew(jobData);
        }
      }

      for (const messagingEvent of entry.messaging ?? []) {
        // Same structural guard as above, applied defensively here too —
        // Convozy doesn't currently subscribe to message_echoes, so this
        // shouldn't be reachable in practice, but a broken/self-authored
        // conversation-sourced event must never be treated as a real viewer
        // either.
        if (await this.instagramService.isOwnAccountComment(instagramAccountId, { id: messagingEvent.sender.id })) {
          this.logger.debug(`Dropping self-authored message ${messagingEvent.message?.mid} on account ${instagramAccountId}`);
          continue;
        }

        if (messagingEvent.postback) {
          await this.webhooksService.enqueuePostbackIfNew({
            instagramAccountId,
            senderId: messagingEvent.sender.id,
            payload: messagingEvent.postback.payload,
            mid: messagingEvent.postback.mid,
          });
          continue;
        }

        for (const jobData of this.mapMessagingEventToJobData(messagingEvent, instagramAccountId)) {
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
      fromIgScopedId: change.value.from.id,
      text: change.value.text ?? '',
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Maps one messaging event to zero or more trigger events:
   *  - STORY_REPLY: a message with `reply_to.story`
   *  - STORY_MENTION: a message with a `story_mention` attachment
   *  - REFERRAL: a `messaging_referral` event, or a first message that
   *    carries `referral` (ig.me link / ad click). `text` holds the ref value
   *    so keyword matching works against it. Emitted as its own event id
   *    (`<mid>:referral`) so it never collides with the DM event below.
   *  - DM: any other real message (text or attachment), including the first
   *    message of a referral thread
   * Echoes/self/deleted/unsupported messages are ignored.
   *
   * `fromUsername` is set to the sender's IG-scoped user ID, not a real
   * username: unlike comments, these payloads don't include one, and
   * resolving it would mean an extra Graph API call on every incoming
   * message. Known simplification, flagged in TRACKER.md - the
   * `{{username}}` template resolves through a profile fetch instead. This
   * same field doubles as the outbound recipient ID for the reply (see
   * AutomationsService.dispatchAction and MessagingService - conversation-
   * sourced events are answered via `{ recipient: { id } }`).
   */
  private mapMessagingEventToJobData(
    event: NonNullable<MetaWebhookPayload['entry'][number]['messaging']>[number],
    instagramAccountId: string,
  ): WebhookEventJobData[] {
    const base = {
      instagramAccountId,
      fromUsername: event.sender.id,
      fromIgScopedId: event.sender.id,
      receivedAt: new Date(event.timestamp * 1000).toISOString(),
    };
    const message = event.message;

    if (!message) {
      // messaging_referral (no message body): identified by sender + timestamp.
      if (event.referral) {
        return [
          {
            ...base,
            externalEventId: `referral:${event.sender.id}:${event.timestamp}`,
            source: 'REFERRAL',
            text: event.referral.ref ?? '',
          },
        ];
      }
      return [];
    }

    if (!message.mid || message.is_echo || message.is_self || message.is_deleted || message.is_unsupported) {
      return [];
    }

    const events: WebhookEventJobData[] = [];
    if (message.referral) {
      events.push({
        ...base,
        externalEventId: `${message.mid}:referral`,
        source: 'REFERRAL',
        text: message.referral.ref ?? '',
      });
    }

    if (message.reply_to?.story) {
      events.push({ ...base, externalEventId: message.mid, source: 'STORY_REPLY', text: message.text ?? '' });
    } else if (message.attachments?.some((a) => a.type === 'story_mention')) {
      events.push({ ...base, externalEventId: message.mid, source: 'STORY_MENTION', text: '' });
    } else {
      events.push({ ...base, externalEventId: message.mid, source: 'DM', text: message.text ?? '' });
    }
    return events;
  }
}
