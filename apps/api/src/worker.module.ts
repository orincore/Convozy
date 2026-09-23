import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { resolveEnvFilePath } from './config/env-file-path';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queues/queue.module';
import { InstagramModule } from './modules/instagram/instagram.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { WebhookEventsProcessor } from './queues/processors/webhook-events.processor';
import { AutomationMatchProcessor } from './queues/processors/automation-match.processor';
import { MessageSendProcessor } from './queues/processors/message-send.processor';
import { AiProcessingProcessor } from './queues/processors/ai-processing.processor';
import { TokenRefreshProcessor } from './queues/processors/token-refresh.processor';
import { PostbackEventsProcessor } from './queues/processors/postback-events.processor';

/**
 * Root module for the worker entrypoint (worker.ts). Shares PrismaModule /
 * QueueModule / domain services with app.module.ts (the API entrypoint) but
 * registers queue *processors* instead of HTTP controllers — see
 * CLAUDE.md §3 rule 6 ("workers and the API share the same codebase ... but
 * run as separate processes").
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    InstagramModule,
    AutomationsModule,
    MessagingModule,
    ContactsModule,
  ],
  providers: [
    WebhookEventsProcessor,
    AutomationMatchProcessor,
    MessageSendProcessor,
    AiProcessingProcessor,
    TokenRefreshProcessor,
    PostbackEventsProcessor,
  ],
})
export class WorkerModule {}
