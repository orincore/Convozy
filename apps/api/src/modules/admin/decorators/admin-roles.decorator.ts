import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ADMIN_ROLES_KEY = 'adminRoles';

/** Restricts an admin route to the given AdminRoles. Enforced by AdminRolesGuard. */
export const AdminRoles = (...roles: AdminRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
