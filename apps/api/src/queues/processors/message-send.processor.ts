import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ActionType } from '@prisma/client';
import { QueueName } from '../constants';
import { MessagingService } from '../../modules/messaging/messaging.service';
import { InstagramService } from '../../modules/instagram/instagram.service';

export interface MessageSendJobData {
  workspaceId: string;
  instagramAccountId: string;
  recipientId: string;
  // Which Graph API recipient shape `recipientId` needs, per Meta's Send
  // API: 'comment' -> { recipient: { comment_id } } (private reply to a
  // comment), 'user' -> { recipient: { id } } (reply into a DM/story-reply
  // conversation). Set by AutomationsService.dispatchAction from the
  // originating CommentEvent's source — see MessagingService.callGraphApi.
  recipientType: 'comment' | 'user';
  actionType: ActionType;
  content: Record<string, unknown>;
  commentEventId?: string;
  // How many times this specific job has been re-queued after exhausting
  // BullMQ's own retries — set by the DLQ requeue scan below, not by callers.
  requeueRound?: number;
}

const DLQ_SCAN_JOB_NAME = 'dlq-requeue-scan';
const DLQ_SCAN_JOB_ID = 'message-send-dlq-requeue-scan';
const DLQ_SCAN_CRON = '*/5 * * * *'; // every 5 minutes
const DLQ_SCAN_BATCH_SIZE = 200;
// A failed job gets re-queued with a fresh BullMQ attempt budget up to this
// many times before it's left alone (still fully visible via MessageLog and
// the BullMQ failed set — never silently deleted, per the reliability rule
// in CLAUDE.md §6 and the user's explicit ask that a reply is never lost).
const MAX_REQUEUE_ROUNDS = 5;

/**
 * Sends a single outbound message via the Graph API, delegating to
 * MessagingService (which owns the per-account rate limiter, circuit
 * breaker, and MessageLog persistence — CLAUDE.md §3 rule 4: only the
 * messaging module calls the Graph API for sends).
 *
 * Also runs a periodic DLQ requeue scan on the same queue (BullMQ ties one
 * Worker to one queue, so a second processor can't share it — routing by
 * job name on this one is the standard pattern instead): failed jobs that
 * exhausted their attempts get a fresh attempt budget rather than being
 * abandoned, as long as the account is still ACTIVE and under the round cap.
 */
@Processor(QueueName.MESSAGE_SEND)
export class MessageSendProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly instagramService: InstagramService,
    // Untyped: this queue carries both `send` jobs (MessageSendJobData) and
    // the parameter-less `dlq-requeue-scan` repeatable job, routed by name
    // in process() below.
    @InjectQueue(QueueName.MESSAGE_SEND) private readonly messageSendQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.messageSendQueue.add(
      DLQ_SCAN_JOB_NAME,
      {},
      { repeat: { pattern: DLQ_SCAN_CRON }, jobId: DLQ_SCAN_JOB_ID },
    );
  }

  async process(job: Job<MessageSendJobData>): Promise<void> {
    if (job.name === DLQ_SCAN_JOB_NAME) {
      await this.requeueFailedJobs();
      return;
    }

    this.logger.debug(
      `Sending ${job.data.actionType} to ${job.data.recipientId} via account ${job.data.instagramAccountId}`,
    );
    await this.messagingService.send(job);
  }

  private async requeueFailedJobs(): Promise<void> {
    const failed = await this.messageSendQueue.getFailed(0, DLQ_SCAN_BATCH_SIZE - 1);

    for (const job of failed) {
      if (job.name === DLQ_SCAN_JOB_NAME || !job.data) {
        continue;
      }

      const round = job.data.requeueRound ?? 0;
      if (round >= MAX_REQUEUE_ROUNDS) {
        continue; // given up — still visible via MessageLog + the BullMQ failed set
      }

      const accountActive = await this.instagramService.isAccountActive(job.data.instagramAccountId);
      if (!accountActive) {
        continue; // permanent until the creator reconnects — don't burn a round on it
      }

      const jobId = job.id;
      await job.remove();
      await this.messageSendQueue.add(
        'send',
        { ...job.data, requeueRound: round + 1 },
        { jobId: `${jobId}-requeue-${round + 1}` },
      );
      this.logger.log(`Requeued failed message-send job ${jobId} (round ${round + 1})`);
    }
  }
}
