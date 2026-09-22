import { Module } from '@nestjs/common';
import { QueueModule } from '../../queues/queue.module';
import { InstagramModule } from '../instagram/instagram.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [QueueModule, InstagramModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
