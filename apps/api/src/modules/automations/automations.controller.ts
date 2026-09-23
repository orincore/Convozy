import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.automationsService.list(user.workspaceId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.automationsService.findOne(user.workspaceId, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAutomationDto) {
    return this.automationsService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateAutomationDto) {
    return this.automationsService.update(user.workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.automationsService.remove(user.workspaceId, id);
  }
}
