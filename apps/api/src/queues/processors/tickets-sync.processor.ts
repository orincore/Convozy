import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QueueName } from '../constants';
import { InstagramService } from '../../modules/instagram/instagram.service';
import { TicketsService } from '../../modules/tickets/tickets.service';

const SYNC_JOB_ID = 'tickets-tagged-posts-sync';
const SYNC_CRON = '*/30 * * * *'; // every 30 minutes

/**
 * Instagram sends no webhook when another account tags yours in a post, so
 * tagged posts are found by polling GET /<ig-user-id>/tags per account. Each
 * post is a ticket keyed on its media id, so re-seeing the same post is a no-op.
 */
@Processor(QueueName.TICKETS_SYNC)
export class TicketsSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TicketsSyncProcessor.name);

  constructor(
    private readonly instagramService: InstagramService,
    private readonly ticketsService: TicketsService,
    @InjectQueue(QueueName.TICKETS_SYNC) private readonly syncQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.syncQueue.add('sync', {}, { repeat: { pattern: SYNC_CRON }, jobId: SYNC_JOB_ID });
  }

  async process(_job: Job): Promise<void> {
    for (const accountId of await this.instagramService.listActiveAccountIds()) {
      try {
        const tagged = await this.instagramService.listTaggedMedia(accountId);
        for (const item of tagged ?? []) {
          await this.ticketsService.ingestTaggedPost(accountId, item);
        }
      } catch (err) {
        // One account failing must not stop the others.
        this.logger.error(`Tagged posts sync failed for account ${accountId}: ${(err as Error).message}`);
      }
    }
  }
}
