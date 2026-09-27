import { Module } from '@nestjs/common';
import { InstagramModule } from '../instagram/instagram.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ContactsModule } from '../contacts/contacts.module';
import { TeamModule } from '../team/team.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketEventsService } from './ticket-events.service';
import { SavedRepliesController } from './saved-replies.controller';
import { SavedRepliesService } from './saved-replies.service';

@Module({
  imports: [InstagramModule, MessagingModule, ContactsModule, TeamModule],
  // SavedRepliesController's static /tickets/saved-replies route must be
  // registered before TicketsController's /tickets/:id, or Express would
  // match "saved-replies" as the :id param — controller declaration order
  // here is what determines Nest/Express route registration order.
  controllers: [SavedRepliesController, TicketsController],
  providers: [TicketsService, TicketEventsService, SavedRepliesService],
  exports: [TicketsService],
})
export class TicketsModule {}
