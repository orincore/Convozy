import { Module } from '@nestjs/common';
import { InstagramModule } from '../instagram/instagram.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ContactsModule } from '../contacts/contacts.module';
import { TeamModule } from '../team/team.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [InstagramModule, MessagingModule, ContactsModule, TeamModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
