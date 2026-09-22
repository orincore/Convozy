import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { ConflictAppException } from '../../common/utils/app-exception';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { EntitlementsService } from '../billing/entitlements.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleProfile } from './strategies/google.strategy';

const BCRYPT_SALT_ROUNDS = 12;
const EXCHANGE_CODE_TTL_SECONDS = 60;
const REFRESH_TOKEN_REDIS_PREFIX = 'auth:refresh:';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RefreshTokenPayload {
  sub: string;
  workspaceId: string;
  role: string;
  email: string;
  jti: string;
}

/** Parses env-style duration strings ("30d", "15m", "45s", "2h") into seconds, for Redis EX. */
function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}"`);
  }
  const value = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unitSeconds;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictAppException('USER_EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const workspace = await this.prisma.workspace.create({
      data: { name: dto.workspaceName },
    });
    await this.entitlementsService.ensureFreeSubscription(workspace.id);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'OWNER',
        workspaceId: workspace.id,
      },
    });

    return this.issueTokens(user.id, workspace.id, user.role, user.email);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash) {
      // Same generic message whether the user doesn't exist or is a
      // Google-only account — never reveal which, per CLAUDE.md §5a A07
      // (no user enumeration via differing error messages).
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, user.workspaceId, user.role, user.email);
  }

  /**
   * Finds an existing user by Google ID (or links an existing email/password
   * account by email), or creates a new Workspace + User. Called from the
   * Google OAuth callback route.
   */
  async loginOrRegisterWithGoogle(profile: GoogleProfile): Promise<AuthTokens> {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId: profile.googleId },
        });
      } else {
        const workspace = await this.prisma.workspace.create({
          data: { name: `${profile.name}'s Workspace` },
        });
        await this.entitlementsService.ensureFreeSubscription(workspace.id);
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
            role: 'OWNER',
            workspaceId: workspace.id,
          },
        });
      }
    }

    this.logger.log(`Google sign-in for ${user.email}`);
    return this.issueTokens(user.id, user.workspaceId, user.role, user.email);
  }

  /**
   * Short-lived, one-time exchange code so OAuth tokens never travel in a
   * redirect URL's query string (browser history, server logs, referrer
   * headers) — CLAUDE.md §5a A02/A07. The frontend receives only an opaque
   * code and immediately exchanges it server-side for the real tokens.
   */
  async issueExchangeCode(tokens: AuthTokens): Promise<string> {
    const code = randomUUID();
    await this.redis.set(
      `auth:exchange:${code}`,
      JSON.stringify(tokens),
      'EX',
      EXCHANGE_CODE_TTL_SECONDS,
    );
    return code;
  }

  async consumeExchangeCode(code: string): Promise<AuthTokens> {
    const key = `auth:exchange:${code}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new UnauthorizedException('Exchange code is invalid or expired');
    }
    await this.redis.del(key);
    return JSON.parse(raw) as AuthTokens;
  }

  /**
   * Exchanges a refresh token for a brand new access + refresh token pair
   * (rotation, not reuse — CLAUDE.md §5a A07). The old refresh token's jti
   * is deleted from Redis before the new one is issued, so a refresh token
   * is single-use: replaying an already-rotated token (e.g. one that leaked)
   * fails rather than silently succeeding.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const redisKey = `${REFRESH_TOKEN_REDIS_PREFIX}${payload.jti}`;
    const storedUserId = await this.redis.get(redisKey);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token has already been used or is invalid');
    }
    await this.redis.del(redisKey);

    // Re-fetch rather than trust the old token's payload — role/workspace
    // could have changed since it was issued.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issueTokens(user.id, user.workspaceId, user.role, user.email);
  }

  private async issueTokens(userId: string, workspaceId: string, role: string, email: string): Promise<AuthTokens> {
    const payload = { sub: userId, workspaceId, role, email };
    const refreshTtl = this.configService.get('jwt', { infer: true }).refreshTtl;
    const jti = randomUUID();

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, jti },
      { expiresIn: refreshTtl as import('jsonwebtoken').SignOptions['expiresIn'] },
    );

    await this.redis.set(
      `${REFRESH_TOKEN_REDIS_PREFIX}${jti}`,
      userId,
      'EX',
      durationToSeconds(refreshTtl),
    );

    return { accessToken, refreshToken };
  }
}
