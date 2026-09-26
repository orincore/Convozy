import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { AccountScopeGuard } from '../../common/guards/account-scope.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { SetFieldValueDto } from './dto/set-field-value.dto';

@Controller('contacts')
@UseGuards(AccountScopeGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @AccountId() accountId: string, @Query() query: ListContactsQueryDto) {
    return this.contactsService.listContacts(user.workspaceId, accountId, query);
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
  @HttpCode(HttpStatus.NO_CONTENT)
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
