import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { AccountScopeGuard } from '../../common/guards/account-scope.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateTagDto } from './dto/create-tag.dto';

@Controller('tags')
@UseGuards(AccountScopeGuard)
export class TagsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @AccountId() accountId: string) {
    return this.contactsService.listTags(user.workspaceId, accountId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @AccountId() accountId: string, @Body() dto: CreateTagDto) {
    return this.contactsService.createTag(user.workspaceId, accountId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.deleteTag(user.workspaceId, id);
  }
}
