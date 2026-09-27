/**
 * Platform-admin token storage — deliberately its own localStorage key and
 * its own decode helper, entirely separate from lib/auth.ts's customer
 * session. An admin token is never sent to a customer-facing endpoint or
 * vice versa (see apps/api/src/modules/admin).
 */
const ADMIN_TOKEN_KEY = 'convozy_admin_token';

export function storeAdminToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // localStorage can throw in private-browsing contexts; nothing to do.
  }
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Nothing to do.
  }
}

export interface CurrentAdmin {
  adminId: string;
  email: string;
  role: 'SUPERADMIN' | 'SUPPORT';
}

/** Only used to decide what to show (e.g. the suspend button) — every action is re-authorized server-side. */
export function getCurrentAdmin(): CurrentAdmin | null {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.sub || !payload.role) return null;
    return { adminId: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
