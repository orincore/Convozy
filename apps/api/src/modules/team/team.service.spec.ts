import 'reflect-metadata';

jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    constructor(
      public response: unknown,
      public status: number,
    ) {
      super(typeof response === 'string' ? response : JSON.stringify(response));
    }
  }
  return {
    Injectable: () => () => {},
    HttpException,
    HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
  };
});

import { TeamService } from './team.service';
import { AppException, ConflictAppException, ForbiddenAppException } from '../../common/utils/app-exception';
import { hashInviteToken } from '../../common/utils/invite-token.util';

const owner = { userId: 'owner-1', workspaceId: 'ws-1', role: 'OWNER', email: 'o@x.com' };
const admin = { userId: 'admin-1', workspaceId: 'ws-1', role: 'ADMIN', email: 'a@x.com' };

function makeService() {
  const tx = {
    workspaceInvite: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', ...data })),
    },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    workspaceInvite: { deleteMany: jest.fn() },
    $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
  } as any;
  return { service: new TeamService(prisma), prisma, tx };
}

describe('TeamService.createInvite', () => {
  it('stores only a hash of the token and returns the raw token once', async () => {
    const { service, tx } = makeService();

    const result = await service.createInvite('ws-1', owner, { email: ' New@Person.com ', role: 'MEMBER' });

    const stored = tx.workspaceInvite.create.mock.calls[0][0].data;
    expect(stored.email).toBe('new@person.com');
    expect(stored.tokenHash).toBe(hashInviteToken(result.token));
    expect(stored.tokenHash).not.toBe(result.token);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(tx.workspaceInvite.deleteMany).toHaveBeenCalled(); // replaces an older pending link
  });

  it('only lets the owner invite admins', async () => {
    const { service } = makeService();
    await expect(service.createInvite('ws-1', admin, { email: 'x@y.com', role: 'ADMIN' })).rejects.toThrow(ForbiddenAppException);
  });

  it('rejects an email that already has an account', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u' });
    await expect(service.createInvite('ws-1', owner, { email: 'x@y.com', role: 'MEMBER' })).rejects.toThrow(ConflictAppException);
  });
});

describe('TeamService member management', () => {
  it('protects the owner from removal and role change', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({ id: 'owner-2', role: 'OWNER' });
    await expect(service.removeMember('ws-1', admin, 'owner-2')).rejects.toThrow(ForbiddenAppException);
    await expect(service.updateRole('ws-1', owner, 'owner-2', 'MEMBER')).rejects.toThrow(ForbiddenAppException);
  });

  it('will not let someone remove or re-role themselves', async () => {
    const { service } = makeService();
    await expect(service.removeMember('ws-1', owner, 'owner-1')).rejects.toThrow(AppException);
    await expect(service.updateRole('ws-1', owner, 'owner-1', 'MEMBER')).rejects.toThrow(AppException);
  });

  it('only the owner can remove an admin', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-2', role: 'ADMIN' });
    await expect(service.removeMember('ws-1', admin, 'admin-2')).rejects.toThrow(ForbiddenAppException);

    await service.removeMember('ws-1', owner, 'admin-2');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'admin-2' } });
  });

  it('looks members up inside the workspace only', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.getMember('ws-1', 'someone-else')).rejects.toThrow();
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'someone-else', workspaceId: 'ws-1' } }));
  });
});
