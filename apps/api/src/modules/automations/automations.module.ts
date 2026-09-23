import { Module } from '@nestjs/common';
import { QueueModule } from '../../queues/queue.module';
import { InstagramModule } from '../instagram/instagram.module';
import { BillingModule } from '../billing/billing.module';
import { ContactsModule } from '../contacts/contacts.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [QueueModule, InstagramModule, BillingModule, ContactsModule],
  controllers: [AutomationsController, TemplatesController],
  providers: [AutomationsService, TemplatesService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
