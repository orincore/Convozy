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

import { AccountScopeGuard } from './account-scope.guard';
import { AppException, NotFoundAppException } from '../utils/app-exception';

function run(headers: Record<string, unknown>, account: unknown) {
  const prisma = { instagramAccount: { findFirst: jest.fn().mockResolvedValue(account) } } as any;
  const request: any = { user: { userId: 'u1', workspaceId: 'ws-1', role: 'OWNER', email: 'a@b.c' }, headers };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
  return { promise: new AccountScopeGuard(prisma).canActivate(context), prisma, request };
}

describe('AccountScopeGuard', () => {
  it('accepts an account in the caller’s workspace and exposes it on the request', async () => {
    const { promise, prisma, request } = run({ 'x-instagram-account-id': 'acc-1' }, { id: 'acc-1' });

    await expect(promise).resolves.toBe(true);
    expect(request.instagramAccountId).toBe('acc-1');
    // The workspace comes from the verified user, never from the client.
    expect(prisma.instagramAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'acc-1', workspaceId: 'ws-1' } }));
  });

  it('rejects a request with no account selected', async () => {
    await expect(run({}, null).promise).rejects.toThrow(AppException);
  });

  it('rejects an account id from another workspace as not found', async () => {
    await expect(run({ 'x-instagram-account-id': 'foreign' }, null).promise).rejects.toThrow(NotFoundAppException);
  });
});
