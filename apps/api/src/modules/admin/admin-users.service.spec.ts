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
  return { Injectable: () => () => {}, HttpException, HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, FORBIDDEN: 403 } };
});

import { AdminUsersService } from './admin-users.service';
import { NotFoundAppException, ForbiddenAppException } from '../../common/utils/app-exception';

const superadmin = { adminId: 'admin-1', role: 'SUPERADMIN' as const };
const support = { adminId: 'admin-2', role: 'SUPPORT' as const };

function makeService() {
  const tx = {
    user: { update: jest.fn().mockResolvedValue({ id: 'user-1', isSuspended: true }) },
    adminAuditLog: { create: jest.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
    },
    ticket: { count: jest.fn().mockResolvedValue(0) },
    usageRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    adminAuditLog: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(tx))),
  } as any;
  return { service: new AdminUsersService(prisma), prisma, tx };
}

describe('AdminUsersService.setSuspended', () => {
  it('rejects a SUPPORT admin — only SUPERADMIN can suspend a user', async () => {
    const { service } = makeService();
    await expect(service.setSuspended(support, 'user-1', true)).rejects.toThrow(ForbiddenAppException);
  });

  it('404s on a user ID that does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.setSuspended(superadmin, 'missing', true)).rejects.toThrow(NotFoundAppException);
  });

  it('suspends the user and records an AdminAuditLog row, atomically', async () => {
    const { service, prisma, tx } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    const result = await service.setSuspended(superadmin, 'user-1', true);

    expect(result).toEqual({ id: 'user-1', isSuspended: true });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isSuspended: true, suspendedAt: expect.any(Date) },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin-1', action: 'user.suspend', targetType: 'User', targetId: 'user-1' },
    });
  });

  it('unsuspending clears suspendedAt and logs the opposite action', async () => {
    const { service, prisma, tx } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    tx.user.update.mockResolvedValue({ id: 'user-1', isSuspended: false });

    await service.setSuspended(superadmin, 'user-1', false);

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { isSuspended: false, suspendedAt: null } });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin-1', action: 'user.unsuspend', targetType: 'User', targetId: 'user-1' },
    });
  });
});

describe('AdminUsersService.findOne', () => {
  it('404s on a user ID that does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundAppException);
  });

  it('strips credential fields and assembles the full dossier', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      name: 'Ada',
      role: 'OWNER',
      workspaceId: 'ws-1',
      isSuspended: false,
      suspendedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      passwordHash: 'secret-hash',
      googleId: null,
      workspace: {
        id: 'ws-1',
        name: 'Ada Co',
        createdAt: new Date('2026-01-01'),
        users: [],
        instagramAccounts: [],
        automations: [],
        subscription: null,
        _count: { contacts: 3, tickets: 5 },
      },
    });
    prisma.ticket.count.mockResolvedValue(2);
    prisma.usageRecord.findFirst.mockResolvedValue({ periodStart: new Date(), periodEnd: new Date(), sendsUsed: 10, aiCallsUsed: 1 });
    prisma.adminAuditLog.findMany.mockResolvedValue([{ id: 'aa-1', action: 'user.suspend', metadata: null, createdAt: new Date(), admin: { email: 'admin@convozy.com' } }]);
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'al-1', action: 'instagram.connect', metadata: null, createdAt: new Date(), actor: { email: 'a@b.com', name: 'Ada' } }]);

    const result = await service.findOne('user-1');

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('googleId');
    expect(result.hasPassword).toBe(true);
    expect(result.googleLinked).toBe(false);
    expect(result.workspace.contactsCount).toBe(3);
    expect(result.workspace.ticketsCount).toBe(5);
    expect(result.workspace.openTicketsCount).toBe(2);
    expect(result.workspace).not.toHaveProperty('_count');
    expect(result.adminActions).toHaveLength(1);
    expect(result.recentActivity).toHaveLength(1);
    expect(prisma.ticket.count).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1', status: { notIn: ['RESOLVED', 'CLOSED'] } } });
  });
});
