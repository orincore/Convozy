import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundAppException, ForbiddenAppException } from '../../common/utils/app-exception';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

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

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            instagramAccounts: { select: { id: true, igUsername: true } },
            automations: { select: { id: true } },
            subscription: { select: { planId: true, status: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundAppException('USER_NOT_FOUND', 'No user with this ID.');
    }
    const { passwordHash: _passwordHash, googleId: _googleId, ...safe } = user;
    return safe;
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
