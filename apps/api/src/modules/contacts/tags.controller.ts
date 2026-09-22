import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateTagDto } from './dto/create-tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.contactsService.listTags(user.workspaceId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTagDto) {
    return this.contactsService.createTag(user.workspaceId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.deleteTag(user.workspaceId, id);
  }
}
