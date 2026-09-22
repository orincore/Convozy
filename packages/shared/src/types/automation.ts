/**
 * Trigger/action enums mirrored from apps/api/prisma/schema.prisma, kept
 * here as plain string unions (not imported from @prisma/client) so the
 * web app doesn't need to depend on Prisma's generated client. Keep these
 * in sync with the Prisma schema by hand — see ARCHITECTURE.md §4.
 */
export type TriggerSource = 'COMMENT' | 'DM' | 'STORY_REPLY' | 'LIVE_COMMENT';
export type TriggerMatchType = 'EXACT' | 'CONTAINS' | 'REGEX' | 'AI_INTENT';
export type ActionType = 'SEND_DM' | 'REPLY_COMMENT' | 'SEND_AI_REPLY';
export type AutomationStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';
