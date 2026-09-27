import { Injectable } from '@nestjs/common';
import { AdminRole, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException, ForbiddenAppException } from '../../common/utils/app-exception';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const CLOSED_TICKET_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

const DEFAULT_PAGE_SIZE = 25;

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  workspaceId: string;
  workspaceName: string;
  isSuspended: boolean;
  createdAt: Date;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto): Promise<{ items: AdminUserListItem[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: 'insensitive' as const } },
            { name: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { workspace: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        workspaceId: u.workspaceId,
        workspaceName: u.workspace.name,
        isSuspended: u.isSuspended,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Everything a support/superadmin needs to help this specific person
   * without digging through the DB by hand: their team, every connected
   * Instagram account, billing state, usage this period, and a trail of
   * both workspace activity and admin actions taken on the account.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            users: {
              select: { id: true, email: true, name: true, role: true, isSuspended: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
            instagramAccounts: {
              select: {
                id: true,
                igUsername: true,
                displayName: true,
                profilePictureUrl: true,
                followersCount: true,
                accountType: true,
                pageId: true,
                status: true,
                tokenExpiresAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            automations: {
              select: { id: true, name: true, status: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
            subscription: {
              select: {
                planId: true,
                status: true,
                provider: true,
                currentPeriodEnd: true,
                cancelAtPeriodEnd: true,
                plan: {
                  select: {
                    name: true,
                    slug: true,
                    monthlySendLimit: true,
                    maxInstagramAccounts: true,
                    aiFeaturesEnabled: true,
                    priceUsdCents: true,
                    priceInrPaise: true,
                  },
                },
              },
            },
            _count: { select: { contacts: true, tickets: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'No user with this ID.');
    }

    const [openTicketsCount, latestUsage, adminActions, recentActivity] = await Promise.all([
      this.prisma.ticket.count({ where: { workspaceId: user.workspaceId, status: { notIn: CLOSED_TICKET_STATUSES } } }),
      this.prisma.usageRecord.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { periodStart: 'desc' } }),
      this.prisma.adminAuditLog.findMany({
        where: { targetType: 'User', targetId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { admin: { select: { email: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { actor: { select: { email: true, name: true } } },
      }),
    ]);

    const { passwordHash, googleId, workspace, ...safe } = user;
    const { _count, ...workspaceRest } = workspace;

    return {
      ...safe,
      hasPassword: Boolean(passwordHash),
      googleLinked: Boolean(googleId),
      workspace: {
        ...workspaceRest,
        contactsCount: _count.contacts,
        ticketsCount: _count.tickets,
        openTicketsCount,
        usage: latestUsage,
      },
      adminActions,
      recentActivity,
    };
  }

  async setSuspended(
    admin: { adminId: string; role: AdminRole },
    id: string,
    suspended: boolean,
  ): Promise<{ id: string; isSuspended: boolean }> {
    if (admin.role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenAppException('ADMIN_ROLE_REQUIRED', 'Only a superadmin can suspend or unsuspend a user.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'No user with this ID.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: { isSuspended: suspended, suspendedAt: suspended ? new Date() : null },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId: admin.adminId,
          action: suspended ? 'user.suspend' : 'user.unsuspend',
          targetType: 'User',
          targetId: id,
        },
      });
      return result;
    });

    return { id: updated.id, isSuspended: updated.isSuspended };
  }
}
