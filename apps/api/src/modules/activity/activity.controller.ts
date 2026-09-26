import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { AccountScopeGuard } from '../../common/guards/account-scope.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ActivityService } from './activity.service';

@Controller('activity')
@UseGuards(AccountScopeGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @AccountId() accountId: string) {
    return this.activityService.listRecentEvents(user.workspaceId, accountId);
  }
}
