import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../../modules/contacts/contacts.service';
import { QueueName } from '../constants';
import { AutomationMatchJobData } from './automation-match.processor';

export interface WebhookEventJobData {
  externalEventId: string;
  instagramAccountId: string;
  source: 'COMMENT' | 'DM' | 'STORY_REPLY' | 'LIVE_COMMENT';
  mediaId?: string;
  fromUsername: string;
  // The commenter/sender's IG-scoped user ID — Contact rows are keyed on
  // this. Nullable: additive, and comment-sourced events before this field
  // existed won't have it until Meta redelivers (see CommentEvent's own
  // comment). For STORY_REPLY this is the same value as fromUsername (that
  // field already carries the IG-scoped ID for conversation-sourced events).
  fromIgScopedId?: string;
  text: string;
  receivedAt: string;
}

/**
 * Consumes raw webhook events enqueued by the webhooks module, persists a
 * CommentEvent, and hands off to the automation matching step.
 */
@Processor(QueueName.WEBHOOK_EVENTS)
export class WebhookEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookEventsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
    @InjectQueue(QueueName.AUTOMATION_MATCH)
    private readonly automationMatchQueue: Queue<AutomationMatchJobData>,
  ) {
    super();
  }

  async process(job: Job<WebhookEventJobData>): Promise<void> {
    const data = job.data;
    this.logger.debug(`Processing webhook event ${data.externalEventId} (job ${job.id})`);

    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: data.instagramAccountId },
      select: { workspaceId: true },
    });
    if (!account) {
      this.logger.warn(
        `InstagramAccount ${data.instagramAccountId} no longer exists, dropping event ${data.externalEventId}`,
      );
      return;
    }

    let commentEventId: string;
    try {
      const commentEvent = await this.prisma.commentEvent.create({
        data: {
          workspaceId: account.workspaceId,
          instagramAccountId: data.instagramAccountId,
          externalEventId: data.externalEventId,
          source: data.source,
          mediaId: data.mediaId,
          fromUsername: data.fromUsername,
          fromIgScopedId: data.fromIgScopedId,
          text: data.text,
          receivedAt: new Date(data.receivedAt),
        },
        select: { id: true },
      });
      commentEventId = commentEvent.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Postgres-level dedup backstop (CLAUDE.md §3 rule 3) — the Redis
        // SETNX check in WebhooksService already caught most duplicates;
        // this only fires on a race or a Redis miss.
        this.logger.debug(`CommentEvent already exists for ${data.externalEventId}, skipping`);
        return;
      }
      throw err;
    }

    // Fires for every inbound event, matched or not — a Contact should
    // exist for anyone who has ever interacted, not just people an
    // automation happened to reply to. Non-fatal: contact tracking must
    // never block the core comment-to-DM pipeline (same principle as the
    // non-fatal subscribeToWebhooks call in InstagramService). STORY_REPLY's
    // fromUsername is actually the sender's numeric IG-scoped ID (no real
    // username available in that webhook payload — see mapMessagingEventToJobData),
    // so it's never passed as a display username here.
    await this.contactsService
      .recordInbound(
        account.workspaceId,
        data.instagramAccountId,
        data.fromIgScopedId,
        data.source === 'STORY_REPLY' ? undefined : data.fromUsername,
      )
      .catch((err) => {
        this.logger.error(`Contact tracking failed for event ${data.externalEventId}: ${(err as Error).message}`);
      });

    await this.automationMatchQueue.add(
      'match',
      { commentEventId },
      { jobId: commentEventId }, // idempotency: retries of this job never enqueue a duplicate match job
    );
  }
}
