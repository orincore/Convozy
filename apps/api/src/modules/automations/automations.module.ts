import { Module } from '@nestjs/common';
import { QueueModule } from '../../queues/queue.module';
import { InstagramModule } from '../instagram/instagram.module';
import { BillingModule } from '../billing/billing.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';

@Module({
  imports: [QueueModule, InstagramModule, BillingModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
