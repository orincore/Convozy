import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { SavedRepliesService } from './saved-replies.service';
import { CreateSavedReplyDto, UpdateSavedReplyDto } from './dto/saved-reply.dto';

// Workspace-wide, not per Instagram account — deliberately no
// AccountScopeGuard/AccountId here, unlike TicketsController.
@Controller('tickets/saved-replies')
export class SavedRepliesController {
  constructor(private readonly savedRepliesService: SavedRepliesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.savedRepliesService.list(user.workspaceId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSavedReplyDto) {
    return this.savedRepliesService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateSavedReplyDto) {
    return this.savedRepliesService.update(user.workspaceId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.savedRepliesService.remove(user.workspaceId, id);
  }
}
