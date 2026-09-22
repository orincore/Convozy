import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from './auth';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// Concurrent 401s (e.g. several widgets fetching at once) must not each fire
// their own /auth/refresh — the refresh token is single-use (rotation), so a
// second caller would trade an already-rotated token and fail. Every caller
// during a refresh awaits this one shared promise instead.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;

      const tokens = await res.json();
      storeTokens(tokens);
      return tokens.accessToken as string;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Authenticated JSON fetch — attaches the stored access token, throws
 * ApiError on a non-2xx response. On a 401 (expired 15m access token), it
 * transparently trades the refresh token for a new pair and retries once
 * before giving up — see AuthService.refreshTokens on the backend.
 */
async function authFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (res.status === 401 && !isRetry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return authFetch<T>(path, init, true);
    }
    clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/app/login';
    }
    throw new ApiError('Session expired — please log in again', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// ── Instagram accounts ────────────────────────────────────────────────────

export interface ConnectedAccount {
  id: string;
  igUsername: string;
  accountType: string | null;
  status: string;
  connectedAt: string;
}

export interface RecentMediaItem {
  id: string;
  caption: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
}

export const instagramApi = {
  listAccounts: () => authFetch<ConnectedAccount[]>('/instagram/accounts'),
  startOAuth: () => authFetch<{ url: string }>('/instagram/oauth/start'),
  listMedia: (accountId: string) => authFetch<RecentMediaItem[]>(`/instagram/accounts/${accountId}/media`),
};

// ── Automations ────────────────────────────────────────────────────────────

export type TriggerSource = 'COMMENT' | 'DM' | 'STORY_REPLY' | 'LIVE_COMMENT';
export type TriggerMatchType = 'EXACT' | 'CONTAINS' | 'REGEX' | 'AI_INTENT';
export type ActionType = 'SEND_DM' | 'REPLY_COMMENT' | 'SEND_AI_REPLY' | 'CONDITION';
export type AutomationStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';
export type AutomationScopeType = 'ALL_POSTS' | 'SPECIFIC_POSTS';
export type ActionBranch = 'THEN' | 'ELSE';
export type ConditionField = 'COMMENT_TEXT' | 'SENDER_USERNAME';

export interface TriggerInput {
  source: TriggerSource;
  matchType: TriggerMatchType;
  keywords: string[];
  caseSensitive?: boolean;
}

export interface ActionButtonInput {
  title: string;
  url: string;
}

// Mirrors TriggerInput's matchType options (including the AI_INTENT stub) —
// branching supports every match type a trigger does, not a simplified
// subset (CLAUDE.md §14).
export interface ConditionInput {
  matchType: TriggerMatchType;
  field?: ConditionField;
  keywords: string[];
  caseSensitive?: boolean;
  aiIntentLabel?: string;
}

// A CONDITION action's THEN/ELSE branches. Recursive: either branch can
// itself contain further CONDITION actions, bounded server-side at 5 levels.
export interface ActionChildrenInput {
  then: ActionInput[];
  else: ActionInput[];
}

export interface ActionInput {
  type: ActionType;
  order?: number;
  delaySeconds?: number;
  // Required for every type except CONDITION, which carries no message of
  // its own.
  payload?: { text: string; buttons?: ActionButtonInput[] };
  // Required only for CONDITION actions.
  condition?: ConditionInput;
  children?: ActionChildrenInput;
}

// The read shape of a persisted CONDITION action's test — same fields as
// ConditionInput, plus its own id.
export interface ConditionOutput extends ConditionInput {
  id: string;
}

// The read shape of a persisted Action, recursively — server always returns
// the full branching tree (condition + children), not just a flat list.
export interface AutomationAction {
  id: string;
  type: ActionType;
  order: number;
  delaySeconds: number;
  payload: { text: string; buttons?: ActionButtonInput[] } | null;
  branch: ActionBranch | null;
  condition: ConditionOutput | null;
  children: AutomationAction[];
}

export interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  scopeType: AutomationScopeType;
  scopeMediaIds: string[];
  priority: number;
  instagramAccountId: string;
  triggers: (TriggerInput & { id: string })[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationInput {
  name: string;
  instagramAccountId: string;
  status?: AutomationStatus;
  scopeType?: AutomationScopeType;
  scopeMediaIds?: string[];
  priority?: number;
  triggers: TriggerInput[];
  actions: ActionInput[];
}

export const automationsApi = {
  list: () => authFetch<Automation[]>('/automations'),
  get: (id: string) => authFetch<Automation>(`/automations/${id}`),
  create: (input: CreateAutomationInput) =>
    authFetch<Automation>('/automations', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<CreateAutomationInput>) =>
    authFetch<Automation>(`/automations/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => authFetch<void>(`/automations/${id}`, { method: 'DELETE' }),
};

// ── Activity feed ───────────────────────────────────────────────────────

export type CommentEventStatus = 'PENDING' | 'MATCHED' | 'NO_MATCH' | 'PROCESSED' | 'FAILED';
export type MessageLogStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'RATE_LIMITED' | 'DEAD_LETTERED';

export interface ActivityMessageLog {
  id: string;
  actionType: ActionType;
  status: MessageLogStatus;
  errorCode: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface ActivityEvent {
  id: string;
  source: TriggerSource;
  fromUsername: string;
  text: string;
  status: CommentEventStatus;
  receivedAt: string;
  processedAt: string | null;
  instagramAccount: { id: string; igUsername: string };
  matchedAutomation: { id: string; name: string } | null;
  messageLogs: ActivityMessageLog[];
}

export const activityApi = {
  list: () => authFetch<ActivityEvent[]>('/activity'),
};
