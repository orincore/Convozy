import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeamService } from './team.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('members')
  members(@CurrentUser() user: RequestUser) {
    return this.teamService.listMembers(user.workspaceId);
  }

  @Get('invites')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  invites(@CurrentUser() user: RequestUser) {
    return this.teamService.listInvites(user.workspaceId);
  }

  @Post('invites')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  createInvite(@CurrentUser() user: RequestUser, @Body() dto: CreateInviteDto) {
    return this.teamService.createInvite(user.workspaceId, user, dto);
  }

  @Delete('invites/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvite(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.teamService.revokeInvite(user.workspaceId, id);
  }

  @Patch('members/:id/role')
  @Roles(UserRole.OWNER)
  updateRole(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateMemberRoleDto) {
    return this.teamService.updateRole(user.workspaceId, user, id, dto.role);
  }

  @Delete('members/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.teamService.removeMember(user.workspaceId, user, id);
  }
}
