import { Module } from '@nestjs/common';
import { InstagramModule } from '../instagram/instagram.module';
import { ContactsController } from './contacts.controller';
import { TagsController } from './tags.controller';
import { CustomFieldsController } from './custom-fields.controller';
import { SegmentsController } from './segments.controller';
import { ContactsService } from './contacts.service';
import { MergeTagsService } from './merge-tags.service';

@Module({
  imports: [InstagramModule],
  controllers: [ContactsController, TagsController, CustomFieldsController, SegmentsController],
  providers: [ContactsService, MergeTagsService],
  exports: [ContactsService, MergeTagsService],
})
export class ContactsModule {}
