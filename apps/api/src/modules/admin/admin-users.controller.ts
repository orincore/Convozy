import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin, RequestAdmin } from './decorators/current-admin.decorator';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SetSuspendedDto } from './dto/set-suspended.dto';

/**
 * @Public() opts every route here out of the global customer JwtAuthGuard;
 * AuthGuard('admin-jwt') + AdminRolesGuard re-authenticate/authorize against
 * the separate admin credential space instead (see admin-jwt.strategy.ts).
 */
@Public()
@UseGuards(AuthGuard('admin-jwt'), AdminRolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id/suspend')
  @AdminRoles(AdminRole.SUPERADMIN)
  setSuspended(@CurrentAdmin() admin: RequestAdmin, @Param('id') id: string, @Body() dto: SetSuspendedDto) {
    return this.adminUsersService.setSuspended(admin, id, dto.suspended);
  }
}
