import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateSegmentDto, UpdateSegmentDto } from './dto/create-segment.dto';

@Controller('segments')
export class SegmentsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.contactsService.listSegments(user.workspaceId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.getSegment(user.workspaceId, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSegmentDto) {
    return this.contactsService.createSegment(user.workspaceId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.contactsService.updateSegment(user.workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contactsService.deleteSegment(user.workspaceId, id);
  }

  @Get(':id/members')
  members(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contactsService.getSegmentMembers(
      user.workspaceId,
      id,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get(':id/count')
  async count(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return { count: await this.contactsService.getSegmentCount(user.workspaceId, id) };
  }
}
