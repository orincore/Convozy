/**
 * Dev-stage token storage. localStorage is fine for local testing but is
 * XSS-exposed — before Phase 4's real dashboard ships, revisit this in
 * favor of an httpOnly cookie set by the API (see CLAUDE.md §5a A02/A07).
 */
const ACCESS_TOKEN_KEY = 'convozy_access_token';
const REFRESH_TOKEN_KEY = 'convozy_refresh_token';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function storeTokens(tokens: AuthTokens): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    // localStorage can throw in private-browsing contexts; nothing to do.
  }
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing to do.
  }
}

export interface CurrentUser {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  email: string;
}

/**
 * Who is signed in, read from the access token's own claims. Only used to
 * decide what to show (e.g. admin-only pages); every action is authorized
 * again on the server from the verified token.
 */
export function getCurrentUser(): CurrentUser | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.sub || !payload.role) return null;
    return { userId: payload.sub, role: payload.role, email: payload.email };
  } catch {
    return null;
  }
}
