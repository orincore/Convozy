import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { TagsController } from './tags.controller';
import { CustomFieldsController } from './custom-fields.controller';
import { SegmentsController } from './segments.controller';
import { ContactsService } from './contacts.service';

@Module({
  controllers: [ContactsController, TagsController, CustomFieldsController, SegmentsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
