import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AdminRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/configuration';
import { RequestAdmin } from '../decorators/current-admin.decorator';

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
}

/**
 * Registered under the 'admin-jwt' passport name, verified against
 * ADMIN_JWT_SECRET — entirely separate from the customer JwtStrategy's
 * secret, so a leaked/forged customer token can never authenticate here
 * and vice versa. Admin controllers mark themselves @Public() (opting out
 * of the global customer JwtAuthGuard) and apply AuthGuard('admin-jwt')
 * explicitly instead.
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('adminJwt', { infer: true }).secret,
    });
  }

  validate(payload: AdminJwtPayload): RequestAdmin {
    return { adminId: payload.sub, email: payload.email, role: payload.role };
  }
}
