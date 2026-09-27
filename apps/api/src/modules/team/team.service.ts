import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import {
  AppException,
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
} from '../../common/utils/app-exception';
import { generateInviteToken } from '../../common/utils/invite-token.util';
import { CreateInviteDto } from './dto/create-invite.dto';
import { EmailService } from '../notifications/email.service';
import { renderEmailHtml, escapeHtml } from '../notifications/email-layout';
import { AppConfig } from '../../config/configuration';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MEMBER_SELECT = { id: true, email: true, name: true, role: true, createdAt: true } as const;

/**
 * Workspace members and invites. Roles: OWNER (creator, one per workspace),
 * ADMIN (manages team and settings), MEMBER (works tickets). An invite is
 * always returned as a one-time link (createInvite's return value) so the
 * inviter can copy/share it manually — the invite email below is a
 * best-effort convenience on top of that, not the only way to deliver it.
 */
@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  listMembers(workspaceId: string) {
    return this.prisma.user.findMany({
      where: { workspaceId },
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Used by TicketsService to validate an assignee without touching the users table itself. */
  async getMember(workspaceId: string, userId: string) {
    const member = await this.prisma.user.findFirst({ where: { id: userId, workspaceId }, select: MEMBER_SELECT });
    if (!member) {
      throw new NotFoundAppException('MEMBER_NOT_FOUND', 'That person is not in this workspace.');
    }
    return member;
  }

  listInvites(workspaceId: string) {
    return this.prisma.workspaceInvite.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvite(workspaceId: string, actor: RequestUser, dto: CreateInviteDto) {
    if (dto.role === 'ADMIN' && actor.role !== UserRole.OWNER) {
      throw new ForbiddenAppException('INVITE_ROLE_FORBIDDEN', 'Only the owner can invite admins.');
    }
    const email = dto.email.trim().toLowerCase();

    // Emails are unique across the whole product (one workspace per account).
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictAppException('USER_EMAIL_TAKEN', 'An account with this email already exists.');
    }

    const { token, hash } = generateInviteToken();
    const { invite, workspaceName } = await this.prisma.$transaction(async (tx) => {
      // Re-inviting replaces the previous pending link so only one is live.
      await tx.workspaceInvite.deleteMany({ where: { workspaceId, email, acceptedAt: null } });
      const created = await tx.workspaceInvite.create({
        data: {
          workspaceId,
          email,
          role: dto.role,
          tokenHash: hash,
          invitedById: actor.userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          workspace: { select: { name: true } },
        },
      });
      const { workspace, ...invite } = created;
      return { invite, workspaceName: workspace.name };
    });

    void this.sendInviteEmail({ email, token, workspaceName, invitedByEmail: actor.email });

    // The raw token is returned exactly once; only its hash is stored.
    return { invite, token };
  }

  /**
   * Fire-and-forget: the invite is already usable via the link the caller
   * gets back (createInvite's return value / the frontend's "copy link"
   * flow), so a mail delivery failure here must never fail invite creation.
   */
  private async sendInviteEmail(params: {
    email: string;
    token: string;
    workspaceName: string;
    invitedByEmail: string;
  }): Promise<void> {
    const appBaseUrl = this.configService.get('appBaseUrl', { infer: true });
    const inviteUrl = `${appBaseUrl.replace(/\/$/, '')}/app/invite/${params.token}`;

    try {
      await this.emailService.send({
        to: params.email,
        from: 'noreply',
        subject: `You've been invited to join ${params.workspaceName} on Convozy`,
        html: renderEmailHtml({
          heading: `Join ${params.workspaceName} on Convozy`,
          preheader: `${params.invitedByEmail} invited you to join ${params.workspaceName} on Convozy.`,
          bodyHtml: `<p style="margin:0;">${escapeHtml(params.invitedByEmail)} invited you to join <strong>${escapeHtml(params.workspaceName)}</strong> on Convozy. This link expires in 7 days.</p>`,
          cta: { label: 'Accept invite', url: inviteUrl },
        }),
        text: `${params.invitedByEmail} invited you to join ${params.workspaceName} on Convozy.\n\nAccept the invite: ${inviteUrl}\n\nThis link expires in 7 days. If you weren't expecting this, you can ignore this email.`,
      });
    } catch (err) {
      this.logger.warn(`Invite email failed to send, link is still valid: ${(err as Error).message}`);
    }
  }

  async revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
    const result = await this.prisma.workspaceInvite.deleteMany({ where: { id: inviteId, workspaceId, acceptedAt: null } });
    if (result.count === 0) {
      throw new NotFoundAppException('INVITE_NOT_FOUND', 'Invite not found.');
    }
  }

  async updateRole(workspaceId: string, actor: RequestUser, memberId: string, role: 'ADMIN' | 'MEMBER') {
    if (memberId === actor.userId) {
      throw new AppException('CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role.');
    }
    const member = await this.getMember(workspaceId, memberId);
    if (member.role === UserRole.OWNER) {
      throw new ForbiddenAppException('OWNER_PROTECTED', 'The owner’s role cannot be changed.');
    }
    return this.prisma.user.update({ where: { id: member.id }, data: { role }, select: MEMBER_SELECT });
  }

  async removeMember(workspaceId: string, actor: RequestUser, memberId: string): Promise<void> {
    if (memberId === actor.userId) {
      throw new AppException('CANNOT_REMOVE_SELF', 'You cannot remove yourself.');
    }
    const member = await this.getMember(workspaceId, memberId);
    if (member.role === UserRole.OWNER) {
      throw new ForbiddenAppException('OWNER_PROTECTED', 'The owner cannot be removed.');
    }
    if (member.role === UserRole.ADMIN && actor.role !== UserRole.OWNER) {
      throw new ForbiddenAppException('REMOVE_ADMIN_FORBIDDEN', 'Only the owner can remove an admin.');
    }
    // Tickets assigned to them become unassigned (onDelete: SetNull).
    await this.prisma.user.delete({ where: { id: member.id } });
  }
}
