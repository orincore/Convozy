import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../decorators/current-user.decorator';
import { AppException, NotFoundAppException } from '../utils/app-exception';

export const ACCOUNT_HEADER = 'x-instagram-account-id';

/**
 * Scopes a controller to one connected Instagram account. The dashboard sends
 * the selected account in `X-Instagram-Account-Id`; it is only trusted after
 * checking it belongs to the caller's workspace (from the verified JWT), so a
 * guessed id can never reach another workspace's data (CLAUDE.md 5a A01).
 * Runs after the global JwtAuthGuard.
 */
@Injectable()
export class AccountScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    const header = request.headers?.[ACCOUNT_HEADER];
    const id = Array.isArray(header) ? header[0] : header;

    if (!user || !id || typeof id !== 'string') {
      throw new AppException('ACCOUNT_REQUIRED', 'Select an Instagram account first.');
    }
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id, workspaceId: user.workspaceId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundAppException('INSTAGRAM_ACCOUNT_NOT_FOUND', 'This Instagram account was not found in your workspace.');
    }
    request.instagramAccountId = account.id;
    return true;
  }
}
