import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.contactsService.listCustomFields(user.workspaceId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomFieldDto) {
    return this.contactsService.createCustomField(user.workspaceId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.deleteCustomField(user.workspaceId, id);
  }
}
