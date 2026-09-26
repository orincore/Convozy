import { Body, Controller, Get, Header, MessageEvent, Param, Patch, Post, Put, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { AccountScopeGuard } from '../../common/guards/account-scope.guard';
import { UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TicketsService } from './tickets.service';
import { TicketEventsService } from './ticket-events.service';
import { ListTicketsQueryDto } from './dto/list-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketSettingsDto } from './dto/update-settings.dto';
import { NoteDto, ReplyDto } from './dto/reply.dto';

@Controller('tickets')
@UseGuards(AccountScopeGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketEvents: TicketEventsService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @AccountId() accountId: string, @Query() query: ListTicketsQueryDto) {
    return this.ticketsService.list(user.workspaceId, accountId, user, query);
  }

  /**
   * Live updates for the selected account's tickets (Server-Sent Events). The
   * dashboard reads it with fetch so it can send the Authorization header.
   * X-Accel-Buffering stops nginx from holding the events back.
   */
  @Sse('stream')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  stream(@CurrentUser() user: RequestUser, @AccountId() accountId: string): Observable<MessageEvent> {
    return this.ticketEvents.stream(user.workspaceId, accountId);
  }

  @Get('counts')
  counts(@CurrentUser() user: RequestUser, @AccountId() accountId: string) {
    return this.ticketsService.counts(user.workspaceId, accountId, user);
  }

  @Get('settings')
  settings(@CurrentUser() user: RequestUser, @AccountId() accountId: string) {
    return this.ticketsService.getSettings(user.workspaceId, accountId);
  }

  @Put('settings')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  updateSettings(@CurrentUser() user: RequestUser, @AccountId() accountId: string, @Body() dto: UpdateTicketSettingsDto) {
    return this.ticketsService.updateSettings(user.workspaceId, accountId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.ticketsService.get(user.workspaceId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(user.workspaceId, user, id, dto);
  }

  @Get(':id/participants/:participantId/history')
  history(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('participantId') participantId: string) {
    return this.ticketsService.getHistory(user.workspaceId, id, participantId);
  }

  @Post(':id/replies')
  reply(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.ticketsService.reply(user.workspaceId, user, id, dto);
  }

  @Post(':id/notes')
  note(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.ticketsService.addNote(user.workspaceId, user, id, dto);
  }
}
