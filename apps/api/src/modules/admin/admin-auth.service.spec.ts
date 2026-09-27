import 'reflect-metadata';

jest.mock('@nestjs/common', () => {
  class UnauthorizedException extends Error {}
  return { Injectable: () => () => {}, UnauthorizedException };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';

function makeService(overrides: { admin?: unknown } = {}) {
  const prisma = {
    adminUser: {
      findUnique: jest.fn().mockResolvedValue(overrides.admin),
      update: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
  const jwtService = { sign: jest.fn(() => 'signed-token') } as any;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'adminJwt') return { secret: 'admin-secret', ttl: '12h' };
      throw new Error(`unexpected config key ${key}`);
    }),
  } as any;
  return { service: new AdminAuthService(prisma, jwtService, configService), prisma, jwtService };
}

describe('AdminAuthService.login', () => {
  it('rejects an unknown email with the same generic message as a wrong password', async () => {
    const { service } = makeService({ admin: null });
    await expect(service.login({ email: 'nobody@x.com', password: 'whatever1' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a wrong password without leaking which part was wrong', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    const { service } = makeService({ admin: { id: 'admin-1', email: 'a@x.com', passwordHash, role: 'SUPPORT' } });
    await expect(service.login({ email: 'a@x.com', password: 'wrong-password' })).rejects.toThrow(UnauthorizedException);
  });

  it('signs a token with the separate admin JWT secret, never the default JwtService config', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    const { service, jwtService, prisma } = makeService({
      admin: { id: 'admin-1', email: 'a@x.com', passwordHash, role: 'SUPERADMIN' },
    });

    const result = await service.login({ email: 'a@x.com', password: 'correct-password' });

    expect(result.accessToken).toBe('signed-token');
    expect(jwtService.sign).toHaveBeenCalledWith(
      { sub: 'admin-1', email: 'a@x.com', role: 'SUPERADMIN' },
      { secret: 'admin-secret', expiresIn: '12h' },
    );
    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });
});
