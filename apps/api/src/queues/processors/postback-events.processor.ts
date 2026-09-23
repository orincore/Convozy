import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName } from '../constants';
import { AutomationsService } from '../../modules/automations/automations.service';

export interface PostbackEventJobData {
  instagramAccountId: string;
  // IGSID of the person who tapped the button.
  senderId: string;
  // "<actionId>:<buttonIndex>" — see AutomationsService.createActionTree.
  payload: string;
  // The postback's own message id, from Meta's messaging_postbacks webhook —
  // used as a stable jobId downstream (AutomationsService.resolvePostback)
  // so a redelivery can't double-send.
  mid: string;
}

/**
 * Resolves a tapped DM button (messaging_postbacks webhook) to its
 * pre-configured response and sends it. The actual resolution/follow-check/
 * dispatch logic lives in AutomationsService (it owns the Action model —
 * CLAUDE.md §3 rule 1), this processor just invokes it per job.
 */
@Processor(QueueName.POSTBACK_EVENTS)
export class PostbackEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(PostbackEventsProcessor.name);

  constructor(private readonly automationsService: AutomationsService) {
    super();
  }

  async process(job: Job<PostbackEventJobData>): Promise<void> {
    this.logger.debug(`Resolving postback ${job.data.payload} from ${job.data.senderId}`);
    await this.automationsService.resolvePostback(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PostbackEventJobData> | undefined, error: Error): void {
    this.logger.error(
      `Postback resolution permanently failed for ${job?.data.payload} after ${job?.attemptsMade} attempts: ${error.message}`,
    );
  }
}
