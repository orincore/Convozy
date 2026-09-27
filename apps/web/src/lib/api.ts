import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from './auth';
import { ACCOUNT_HEADER, getSelectedAccountId } from './account';

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

export async function refreshAccessToken(): Promise<string | null> {
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
  const accountId = getSelectedAccountId();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(accountId ? { [ACCOUNT_HEADER]: accountId } : {}),
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

/**
 * Multipart upload — deliberately NOT authFetch, which always forces
 * `Content-Type: application/json` whenever a body is present. Sending a
 * FormData body under that header breaks the multipart boundary Meta/the
 * browser needs; the browser must set Content-Type itself here.
 */
async function authUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Upload failed (${res.status})`, res.status);
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
  // Cached profile preview — populated at connect time and refreshed
  // opportunistically server-side, never fetched live on page load.
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  profileSyncedAt: string | null;
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
  listStories: (accountId: string) => authFetch<RecentMediaItem[]>(`/instagram/accounts/${accountId}/stories`),
  syncProfile: (accountId: string) =>
    authFetch<ConnectedAccount>(`/instagram/accounts/${accountId}/sync-profile`, { method: 'POST' }),
  disconnect: (accountId: string) => authFetch<void>(`/instagram/accounts/${accountId}`, { method: 'DELETE' }),
};

// ── Media uploads (Cloudflare R2 — DM attachments) ─────────────────────────

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

export interface UploadedMedia {
  url: string;
  type: MediaKind;
  sizeBytes: number;
  filename: string;
}

export const mediaApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return authUpload<UploadedMedia>('/media/upload', formData);
  },
};

// ── Automations ────────────────────────────────────────────────────────────

export type TriggerSource = 'COMMENT' | 'DM' | 'STORY_REPLY' | 'LIVE_COMMENT' | 'STORY_MENTION' | 'REFERRAL';
export type TriggerMatchType = 'EXACT' | 'CONTAINS' | 'REGEX' | 'AI_INTENT';
export type ActionType = 'SEND_DM' | 'REPLY_COMMENT' | 'SEND_AI_REPLY' | 'CONDITION' | 'HIDE_COMMENT';
export type AutomationStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';
export type AutomationScopeType = 'ALL_POSTS' | 'SPECIFIC_POSTS' | 'ALL_STORIES' | 'SPECIFIC_STORIES';
export type ActionBranch = 'THEN' | 'ELSE';
export type ConditionField = 'COMMENT_TEXT' | 'SENDER_USERNAME';

export interface TriggerInput {
  source: TriggerSource;
  matchType: TriggerMatchType;
  keywords: string[];
  caseSensitive?: boolean;
}

export type ActionButtonKind = 'WEB_URL' | 'POSTBACK' | 'FOLLOW_PROFILE';

// A button on a SEND_DM message (Meta's Button Template — up to 3 per
// message). FOLLOW_PROFILE opens the connected account's own profile (the
// server resolves the link at send time). WEB_URL opens a link. POSTBACK fires a tap-to-unlock response:
// `unlockedText`/`unlockedMedia` (exactly one of the two) is sent back
// immediately, unless `requireFollow` is set, in which case Convozy checks
// live whether the tapper follows the account and sends the locked pair
// instead if they don't. `payload` is server-generated (see the backend's
// ActionButtonDto) — never set it from the client.
export interface ActionButtonInput {
  title: string;
  type: ActionButtonKind;
  url?: string;
  payload?: string;
  requireFollow?: boolean;
  unlockedText?: string;
  unlockedMedia?: ActionMediaInput;
  lockedText?: string;
  lockedMedia?: ActionMediaInput;
  // Link buttons attached to the reply text (not valid on a media reply).
  unlockedButtons?: ReplyLinkButtonInput[];
  lockedButtons?: ReplyLinkButtonInput[];
}

export interface ReplyLinkButtonInput {
  title: string;
  // Omitted for FOLLOW_PROFILE (the server links to the account's own profile).
  url?: string;
  // RETRY re-shows the original button in the "not following yet" reply.
  type?: 'WEB_URL' | 'FOLLOW_PROFILE' | 'RETRY';
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

// A media attachment on a SEND_DM message — image (incl. GIF), video,
// audio, or a PDF file. `url` always comes from mediaApi.upload (R2-hosted),
// never typed in freehand. Mutually exclusive with `buttons` on the same
// payload (enforced server-side — Meta sends these as different message
// shapes) and, since Meta's raw attachment send has no caption field, `text`
// is not required when `media` is set.
export interface ActionMediaInput {
  type: MediaKind;
  url: string;
}

export interface ActionInput {
  type: ActionType;
  order?: number;
  delaySeconds?: number;
  // Required for every type except CONDITION and HIDE_COMMENT, and unless
  // `media` is set (a media-only message has no text of its own).
  payload?: { text?: string; buttons?: ActionButtonInput[]; media?: ActionMediaInput };
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
  payload: { text?: string; buttons?: ActionButtonInput[]; media?: ActionMediaInput } | null;
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
  // The builder's saved state while status is DRAFT (null otherwise).
  draft?: Record<string, unknown> | null;
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
  createDraft: (input: { name?: string; instagramAccountId: string; data: Record<string, unknown> }) =>
    authFetch<Automation>('/automations/drafts', { method: 'POST', body: JSON.stringify(input) }),
  updateDraft: (id: string, input: { name?: string; data: Record<string, unknown> }) =>
    authFetch<Automation>(`/automations/${id}/draft`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => authFetch<void>(`/automations/${id}`, { method: 'DELETE' }),
};

// ── Automation templates (Milestone 3) ─────────────────────────────────────

// Curated starter automations — GET returns the full trigger/action payload
// so the "New automation" builder can prefill its own local state for
// review/editing rather than installing blind (see templates.seed.ts on the
// backend for the design rationale).
export interface AutomationTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  triggers: TriggerInput[];
  actions: ActionInput[];
  createdAt: string;
  updatedAt: string;
}

export const templatesApi = {
  list: () => authFetch<AutomationTemplate[]>('/automation-templates'),
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

// ── Contacts / Tags / Custom Fields / Segments (Milestone 2) ──────────────

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE';

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  createdAt: string;
  updatedAt: string;
}

export interface ContactFieldValue {
  id: string;
  value: string;
  customField: CustomField;
}

export interface Contact {
  id: string;
  instagramAccountId: string;
  igScopedId: string;
  username: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  tags: { tagId: string; tag: Tag }[];
  fieldValues: ContactFieldValue[];
  createdAt: string;
  updatedAt: string;
}

export interface ListContactsResult {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
}

// Mirrors SegmentRuleOp/SegmentRuleDto on the backend (contacts/dto/segment-rule.dto.ts).
export type SegmentRuleOp = 'eq' | 'neq' | 'contains';

export interface SegmentFieldRule {
  key: string;
  op: SegmentRuleOp;
  value: string;
}

export interface SegmentRule {
  all?: SegmentRule[];
  any?: SegmentRule[];
  tag?: string;
  field?: SegmentFieldRule;
}

export interface Segment {
  id: string;
  name: string;
  rules: SegmentRule;
  createdAt: string;
  updatedAt: string;
}

export const tagsApi = {
  list: () => authFetch<Tag[]>('/tags'),
  create: (input: { name: string; color?: string }) =>
    authFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => authFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
};

export const customFieldsApi = {
  list: () => authFetch<CustomField[]>('/custom-fields'),
  create: (input: { key: string; label: string; type: CustomFieldType }) =>
    authFetch<CustomField>('/custom-fields', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => authFetch<void>(`/custom-fields/${id}`, { method: 'DELETE' }),
};

export const contactsApi = {
  list: (query: { instagramAccountId?: string; tagId?: string; segmentId?: string; page?: number } = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    const qs = params.toString();
    return authFetch<ListContactsResult>(`/contacts${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => authFetch<Contact>(`/contacts/${id}`),
  addTag: (id: string, tagId: string) => authFetch<void>(`/contacts/${id}/tags/${tagId}`, { method: 'POST' }),
  removeTag: (id: string, tagId: string) => authFetch<void>(`/contacts/${id}/tags/${tagId}`, { method: 'DELETE' }),
  setField: (id: string, customFieldId: string, value: string) =>
    authFetch<void>(`/contacts/${id}/fields/${customFieldId}`, { method: 'PATCH', body: JSON.stringify({ value }) }),
};

export const segmentsApi = {
  list: () => authFetch<Segment[]>('/segments'),
  get: (id: string) => authFetch<Segment>(`/segments/${id}`),
  create: (input: { name: string; rules: SegmentRule }) =>
    authFetch<Segment>('/segments', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<{ name: string; rules: SegmentRule }>) =>
    authFetch<Segment>(`/segments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => authFetch<void>(`/segments/${id}`, { method: 'DELETE' }),
  members: (id: string, page?: number) =>
    authFetch<{ contacts: Contact[]; total: number }>(`/segments/${id}/members${page ? `?page=${page}` : ''}`),
  count: (id: string) => authFetch<{ count: number }>(`/segments/${id}/count`),
};

// ── Tickets (support CRM) ─────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketSource = 'COMMENT' | 'DM' | 'STORY_MENTION' | 'REFERRAL' | 'TAGGED_POST';

export interface TicketAssignee {
  id: string;
  name: string | null;
  email: string;
}

export interface TicketListItem {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  mediaPermalink: string | null;
  lastActivityAt: string;
  createdAt: string;
  assignee: TicketAssignee | null;
  participantCount: number;
  participants: { username: string | null }[];
  lastMessage: { text: string; kind: 'INBOUND' | 'OUTBOUND' | 'NOTE' } | null;
}

export interface TicketList {
  total: number;
  page: number;
  limit: number;
  items: TicketListItem[];
}

export interface TicketCounts {
  status: Partial<Record<TicketStatus, number>>;
  active: number;
  unassigned: number;
  mine: number;
}

export interface TicketReplyOptions {
  canPublicReply: boolean;
  // HUMAN_AGENT = a person replying up to 7 days after their last message (Instagram's Human Agent tag).
  dmMode: 'DM' | 'HUMAN_AGENT' | 'PRIVATE_REPLY' | null;
  dmUnavailableReason: string | null;
}

export interface TicketParticipant {
  id: string;
  igScopedId: string | null;
  username: string | null;
  contactId: string | null;
  lastInboundAt: string | null;
  latestCommentId: string | null;
  replyOptions: TicketReplyOptions;
}

export interface TicketMessage {
  id: string;
  participantId: string | null;
  kind: 'INBOUND' | 'OUTBOUND' | 'NOTE';
  channel: 'COMMENT' | 'DM' | 'PUBLIC_REPLY' | 'NOTE' | 'TAGGED_POST';
  text: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  createdAt: string;
  author: { id: string; name: string | null } | null;
}

export interface TicketEvent {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
}

export interface TicketDetail {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  mediaId: string | null;
  mediaPermalink: string | null;
  createdAt: string;
  lastActivityAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  assignee: TicketAssignee | null;
  instagramAccount: { id: string; igUsername: string };
  participants: TicketParticipant[];
  messages: TicketMessage[];
  events: TicketEvent[];
}

/** One message of the person's Instagram DM thread, read live from Instagram. */
export interface TicketHistoryMessage {
  id: string;
  text: string;
  fromCustomer: boolean;
  createdAt: string;
  hasAttachment: boolean;
}

export interface TicketHistory {
  available: boolean;
  messages: TicketHistoryMessage[];
}

export interface TicketSettings {
  enabled: boolean;
  keywords: string[];
  createFromMentions: boolean;
  createFromAllDms: boolean;
  createFromStoryMentions: boolean;
  createFromReferrals: boolean;
  createFromTaggedPosts: boolean;
}

export interface ListTicketsParams {
  view?: 'active' | 'closed' | 'all';
  status?: TicketStatus;
  priority?: TicketPriority;
  source?: TicketSource;
  assignee?: string;
  search?: string;
  page?: number;
}

export const ticketsApi = {
  list: (params: ListTicketsParams = {}) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    const query = qs.toString();
    return authFetch<TicketList>(`/tickets${query ? `?${query}` : ''}`);
  },
  counts: () => authFetch<TicketCounts>('/tickets/counts'),
  get: (id: string) => authFetch<TicketDetail>(`/tickets/${id}`),
  update: (id: string, input: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null; subject?: string }) =>
    authFetch<TicketDetail>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  reply: (id: string, input: { participantId: string; channel: 'DM' | 'PUBLIC_REPLY'; text: string }) =>
    authFetch<TicketMessage>(`/tickets/${id}/replies`, { method: 'POST', body: JSON.stringify(input) }),
  addNote: (id: string, text: string) =>
    authFetch<TicketMessage>(`/tickets/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),
  history: (id: string, participantId: string) =>
    authFetch<TicketHistory>(`/tickets/${id}/participants/${participantId}/history`),
  getSettings: () => authFetch<TicketSettings>('/tickets/settings'),
  // Only the editable fields are sent: the API rejects unknown properties, and
  // the record it returns also carries id, workspaceId, instagramAccountId and updatedAt.
  updateSettings: (input: Partial<TicketSettings>) => {
    const {
      enabled,
      keywords,
      createFromMentions,
      createFromAllDms,
      createFromStoryMentions,
      createFromReferrals,
      createFromTaggedPosts,
    } = input;
    return authFetch<TicketSettings>('/tickets/settings', {
      method: 'PUT',
      body: JSON.stringify({
        enabled,
        keywords,
        createFromMentions,
        createFromAllDms,
        createFromStoryMentions,
        createFromReferrals,
        createFromTaggedPosts,
      }),
    });
  },
};

// ── Team ──────────────────────────────────────────────────────────────────

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: TeamRole;
  createdAt: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
  createdAt: string;
}

export const teamApi = {
  members: () => authFetch<TeamMember[]>('/team/members'),
  invites: () => authFetch<TeamInvite[]>('/team/invites'),
  invite: (input: { email: string; role: 'ADMIN' | 'MEMBER' }) =>
    authFetch<{ invite: TeamInvite; token: string }>('/team/invites', { method: 'POST', body: JSON.stringify(input) }),
  revokeInvite: (id: string) => authFetch<void>(`/team/invites/${id}`, { method: 'DELETE' }),
  updateRole: (id: string, role: 'ADMIN' | 'MEMBER') =>
    authFetch<TeamMember>(`/team/members/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  remove: (id: string) => authFetch<void>(`/team/members/${id}`, { method: 'DELETE' }),
};

/** Public: what an invite link is for (no login needed). */
export async function previewInvite(token: string): Promise<{ email: string; role: TeamRole; workspaceName: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/invites/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'This invite link is invalid or has expired.', res.status);
  }
  return res.json();
}
