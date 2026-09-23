import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { TemplatesService } from './templates.service';
import { InstallTemplateDto } from './dto/install-template.dto';

@Controller('automation-templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list() {
    return this.templatesService.list();
  }

  @Post(':id/install')
  install(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: InstallTemplateDto) {
    return this.templatesService.install(user.workspaceId, id, dto.instagramAccountId);
  }
}
