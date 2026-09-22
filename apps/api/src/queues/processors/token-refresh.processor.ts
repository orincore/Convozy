import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QueueName } from '../constants';
import { InstagramService } from '../../modules/instagram/instagram.service';

const SCAN_JOB_ID = 'token-refresh-scan';
const SCAN_CRON = '0 * * * *'; // hourly

/**
 * Periodically renews Instagram long-lived tokens before they expire.
 * Long-lived tokens last ~60 days and are only actually refreshed once
 * they're within InstagramService's renewal window, so an hourly scan is
 * cheap and idempotent.
 */
@Processor(QueueName.TOKEN_REFRESH)
export class TokenRefreshProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(
    private readonly instagramService: InstagramService,
    @InjectQueue(QueueName.TOKEN_REFRESH) private readonly tokenRefreshQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // BullMQ dedupes repeatable jobs by (jobId, pattern), so re-registering
    // this on every worker restart doesn't create duplicate schedules.
    await this.tokenRefreshQueue.add(
      'scan',
      {},
      { repeat: { pattern: SCAN_CRON }, jobId: SCAN_JOB_ID },
    );
  }

  async process(_job: Job): Promise<void> {
    const accountIds = await this.instagramService.findAccountsNeedingTokenRefresh();
    if (accountIds.length === 0) {
      return;
    }
    this.logger.debug(`Token refresh scan: ${accountIds.length} account(s) due`);

    for (const accountId of accountIds) {
      try {
        await this.instagramService.refreshAccountToken(accountId);
      } catch (err) {
        // One account's failure must never stop the others (CLAUDE.md's
        // per-account isolation principle) — logged and skipped.
        this.logger.error(`Token refresh failed for account ${accountId}: ${(err as Error).message}`);
      }
    }
  }
}
