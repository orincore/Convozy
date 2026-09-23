import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { resolveEnvFilePath } from './config/env-file-path';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queues/queue.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InstagramModule } from './modules/instagram/instagram.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { MediaModule } from './modules/media/media.module';

/**
 * Root module for the API (HTTP) entrypoint (main.ts). See worker.module.ts
 * for the worker entrypoint's root module. Domain modules are added here as
 * they're actually implemented (TRACKER.md tracks what's left) — see
 * CLAUDE.md "don't build ahead of the current phase."
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
    AuthModule,
    HealthModule,
    InstagramModule,
    WebhooksModule,
    AutomationsModule,
    ActivityModule,
    ContactsModule,
    MediaModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
