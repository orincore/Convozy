import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName } from '../constants';
import { AutomationsService } from '../../modules/automations/automations.service';

export interface AutomationMatchJobData {
  commentEventId: string;
}

/**
 * Loads a CommentEvent, matches it against the instagram account's active
 * Automations/Triggers, and enqueues MESSAGE_SEND (and/or AI_PROCESSING) jobs
 * for matched Actions. The actual matching engine lives in
 * AutomationsService (it owns the Automation/Trigger/Action models —
 * CLAUDE.md §3 rule 1), this processor just invokes it per job.
 */
@Processor(QueueName.AUTOMATION_MATCH)
export class AutomationMatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationMatchProcessor.name);

  constructor(private readonly automationsService: AutomationsService) {
    super();
  }

  async process(job: Job<AutomationMatchJobData>): Promise<void> {
    this.logger.debug(`Matching automations for comment event ${job.data.commentEventId}`);
    await this.automationsService.matchCommentEvent(job.data.commentEventId);
  }

  // Without this, a job that exhausts all 5 BullMQ attempts fails
  // completely silently - found the hard way when a real match never
  // produced a DM and nothing in `docker compose logs` explained why (had
  // to inspect the BullMQ failed set directly). CLAUDE.md §6 requires DLQ
  // visibility for every queue; this is the minimum that satisfies it here.
  @OnWorkerEvent('failed')
  onFailed(job: Job<AutomationMatchJobData> | undefined, error: Error): void {
    this.logger.error(
      `Automation match permanently failed for comment event ${job?.data.commentEventId} after ${job?.attemptsMade} attempts: ${error.message}`,
    );
  }
}
