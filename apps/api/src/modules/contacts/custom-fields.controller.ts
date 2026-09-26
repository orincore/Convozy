import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { AccountScopeGuard } from '../../common/guards/account-scope.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';

@Controller('custom-fields')
@UseGuards(AccountScopeGuard)
export class CustomFieldsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @AccountId() accountId: string) {
    return this.contactsService.listCustomFields(user.workspaceId, accountId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @AccountId() accountId: string, @Body() dto: CreateCustomFieldDto) {
    return this.contactsService.createCustomField(user.workspaceId, accountId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.deleteCustomField(user.workspaceId, id);
  }
}
