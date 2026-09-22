import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { SetFieldValueDto } from './dto/set-field-value.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ListContactsQueryDto) {
    return this.contactsService.listContacts(user.workspaceId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.getContact(user.workspaceId, id);
  }

  @Post(':id/tags/:tagId')
  addTag(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.contactsService.addTagToContact(user.workspaceId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  removeTag(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.contactsService.removeTagFromContact(user.workspaceId, id, tagId);
  }

  @Patch(':id/fields/:customFieldId')
  setField(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('customFieldId') customFieldId: string,
    @Body() dto: SetFieldValueDto,
  ) {
    return this.contactsService.setFieldValue(user.workspaceId, id, customFieldId, dto.value);
  }
}
