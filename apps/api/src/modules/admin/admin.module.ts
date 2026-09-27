import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

/**
 * Internal ops: platform-staff login (own AdminUser table/credentials, never
 * the customer User table) and account lookup/suspend. See CLAUDE.md
 * ARCHITECTURE.md §"admin" and the 2026-09-27 decision to keep this fully
 * separate from customer auth (workspace-scoped UserRole must never grant
 * cross-workspace visibility — A01).
 */
@Module({
  imports: [
    PassportModule,
    // No secret registered here — AdminAuthService.login and
    // AdminJwtStrategy both pass ADMIN_JWT_SECRET explicitly per call/guard,
    // so this module's JwtService is never accidentally used with the
    // customer JWT_SECRET (or vice versa).
    JwtModule.register({}),
  ],
  controllers: [AdminAuthController, AdminUsersController],
  providers: [AdminAuthService, AdminUsersService, AdminJwtStrategy],
})
export class AdminModule {}
