-- Entitlements: on/off feature-toggle map per Plan, so gating a feature to a
-- paid tier later is a data change (flip a key), not a migration or rewrite.
-- See billing/entitlements.constants.ts for the known keys.
ALTER TABLE "Plan" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}';

-- Every Workspace gets a Subscription at creation, even on the free plan
-- (see EntitlementsService.ensureFreeSubscription) so entitlement checks
-- always resolve through a real row. NONE covers that case.
ALTER TYPE "PaymentProviderType" ADD VALUE 'NONE';

-- Curated starter automations a workspace can install instead of building
-- from scratch. Global catalog data, not workspace-scoped.
CREATE TABLE "AutomationTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationTemplate_slug_key" ON "AutomationTemplate"("slug");
