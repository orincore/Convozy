import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { QueueName } from './constants';

/**
 * Registers Redis connection + all BullMQ queues in one place. Producers
 * (e.g. webhooks module enqueueing a job) import this module and inject
 * `@InjectQueue(QueueName.WEBHOOK_EVENTS)`. Consumers live in
 * queues/processors and are wired up only in the worker entrypoint
 * (worker.ts) — see CLAUDE.md §3 rule 6.
 *
 * Default job options enforce bounded retries + exponential backoff for
 * every queue (CLAUDE.md §6). Jobs that exhaust retries are handled by each
 * processor's failure handler, which moves them to that queue's DLQ.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const redis = configService.get('redis', { infer: true });
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 24 * 60 * 60, count: 5000 },
            removeOnFail: false, // kept for DLQ inspection until explicitly cleaned up
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QueueName.WEBHOOK_EVENTS },
      { name: QueueName.AUTOMATION_MATCH },
      { name: QueueName.MESSAGE_SEND },
      { name: QueueName.AI_PROCESSING },
      { name: QueueName.BILLING_EVENTS },
      { name: QueueName.TOKEN_REFRESH },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
