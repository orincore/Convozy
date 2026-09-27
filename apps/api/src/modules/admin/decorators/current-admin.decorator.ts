import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export interface RequestAdmin {
  adminId: string;
  email: string;
  role: AdminRole;
}

/** Pulls the authenticated platform admin off the request (set by AdminJwtStrategy). */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAdmin => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestAdmin;
  },
);
