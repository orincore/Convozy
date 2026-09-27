import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async login(dto: AdminLoginDto): Promise<{ accessToken: string }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (!admin) {
      // Same generic message whether the email doesn't exist or the
      // password is wrong — CLAUDE.md §5a A07, no user enumeration.
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const adminJwt = this.configService.get('adminJwt', { infer: true });
    const accessToken = this.jwtService.sign(payload, {
      secret: adminJwt.secret,
      expiresIn: adminJwt.ttl as SignOptions['expiresIn'],
    });
    return { accessToken };
  }
}
