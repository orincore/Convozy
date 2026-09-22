import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName } from '../constants';

export interface AiProcessingJobData {
  commentEventId: string;
  automationId: string;
  kind: 'CLASSIFY_INTENT' | 'GENERATE_REPLY';
}

/**
 * Runs AI work (intent classification / reply generation) off the hot path,
 * per CLAUDE.md §7 ("AI calls are async via a queue ... never inline in the
 * webhook request path"). Delegates to the `ai` module's provider-agnostic
 * AiProvider interface once it exists.
 *
 * TODO(Phase 6, TRACKER.md): implement AiProvider + this processor's calls
 * into it, plus per-workspace AI usage tracking (ARCHITECTURE.md §8).
 */
@Processor(QueueName.AI_PROCESSING)
export class AiProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessingProcessor.name);

  async process(job: Job<AiProcessingJobData>): Promise<void> {
    this.logger.debug(`Running ${job.data.kind} for comment event ${job.data.commentEventId}`);
    // TODO(Phase 6): delegate to AiProvider.
  }
}
