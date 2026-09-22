/**
 * Every gate-able feature gets one entry here — adding a new feature is one
 * line in this file plus a key in the relevant Plan.features JSON (a data
 * change, not a migration). Never check a feature by its raw string
 * elsewhere; always go through this const so a typo is a compile error, not
 * a silently-always-off feature. See MANYCHAT_FEATURE_AUDIT.md for the
 * feature catalog this is being built against.
 */
export const FEATURE_KEYS = {
  LIVE_COMMENT_AUTOMATION: 'live_comment_automation',
  AUTOMATION_TEMPLATES: 'automation_templates',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/** The single Free plan's slug — bootstrapped with every FEATURE_KEYS value on. */
export const FREE_PLAN_SLUG = 'free';
