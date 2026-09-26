import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The Instagram account the dashboard has selected, validated by AccountScopeGuard. */
export const AccountId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest().instagramAccountId as string;
});
