/**
 * Plan slugs shared between the API (Plan.slug in Prisma) and the web
 * dashboard/pricing page, so neither side hardcodes plan strings
 * independently. Actual limits/pricing live in the database (Plan model) —
 * these are just the stable identifiers.
 */
export enum PlanSlug {
  FREE = 'free',
  PRO = 'pro',
}

export const PLAN_DISPLAY_NAMES: Record<PlanSlug, string> = {
  [PlanSlug.FREE]: 'Free',
  [PlanSlug.PRO]: 'Pro',
};
