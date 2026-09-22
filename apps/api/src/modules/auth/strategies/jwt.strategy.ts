import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/configuration';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  workspaceId: string;
  role: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).secret,
    });
  }

  // Runs after signature/expiry verification; return value becomes request.user.
  validate(payload: JwtPayload): RequestUser {
    return {
      userId: payload.sub,
      workspaceId: payload.workspaceId,
      role: payload.role,
      email: payload.email,
    };
  }
}
