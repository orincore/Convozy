import { API_BASE_URL, ApiError } from './api';
import { clearAdminToken, getAdminToken, storeAdminToken } from './admin-auth';

/** Authenticated JSON fetch for the platform-admin panel — no refresh-token
 * flow (the admin JWT is short-lived at 12h; on 401 we just sign back out). */
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearAdminToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    throw new ApiError('Session expired — please log in again', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message ?? 'Something went wrong', res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  workspaceId: string;
  workspaceName: string;
  isSuspended: boolean;
  createdAt: string;
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isSuspended: boolean;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  googleLinked: boolean;
  workspace: {
    id: string;
    name: string;
    createdAt: string;
    users: { id: string; email: string; name: string | null; role: string; isSuspended: boolean; createdAt: string }[];
    instagramAccounts: {
      id: string;
      igUsername: string;
      displayName: string | null;
      profilePictureUrl: string | null;
      followersCount: number | null;
      accountType: string | null;
      pageId: string | null;
      status: string;
      tokenExpiresAt: string | null;
      createdAt: string;
    }[];
    automations: { id: string; name: string; status: string; createdAt: string }[];
    subscription: {
      planId: string;
      status: string;
      provider: string;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      plan: {
        name: string;
        slug: string;
        monthlySendLimit: number;
        maxInstagramAccounts: number;
        aiFeaturesEnabled: boolean;
        priceUsdCents: number | null;
        priceInrPaise: number | null;
      };
    } | null;
    contactsCount: number;
    ticketsCount: number;
    openTicketsCount: number;
    usage: { periodStart: string; periodEnd: string; sendsUsed: number; aiCallsUsed: number } | null;
  };
  adminActions: { id: string; action: string; metadata: unknown; createdAt: string; admin: { email: string } }[];
  recentActivity: { id: string; action: string; metadata: unknown; createdAt: string; actor: { email: string; name: string | null } | null }[];
}

export const adminAuthApi = {
  login: (email: string, password: string) =>
    fetch(`${API_BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Invalid email or password' }));
        throw new ApiError(body.message ?? 'Invalid email or password', res.status);
      }
      const { accessToken } = (await res.json()) as { accessToken: string };
      storeAdminToken(accessToken);
      return accessToken;
    }),
};

export const adminUsersApi = {
  list: (params: { q?: string; page?: number; pageSize?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.page) search.set('page', String(params.page));
    if (params.pageSize) search.set('pageSize', String(params.pageSize));
    const qs = search.toString();
    return adminFetch<AdminUserListResponse>(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => adminFetch<AdminUserDetail>(`/admin/users/${id}`),
  setSuspended: (id: string, suspended: boolean) =>
    adminFetch<{ id: string; isSuspended: boolean }>(`/admin/users/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ suspended }),
    }),
};
