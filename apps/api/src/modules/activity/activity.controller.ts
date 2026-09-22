import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.activityService.listRecentEvents(user.workspaceId);
  }
}
