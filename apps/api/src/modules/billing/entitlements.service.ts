import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentProviderType, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FEATURE_KEYS, FeatureKey, FREE_PLAN_SLUG } from './entitlements.constants';

type FeatureMap = Partial<Record<FeatureKey, boolean>>;

/**
 * The single choke point for "is this feature available to this workspace"
 * (CLAUDE.md §8 — mirrors UsageService's role for send-count limits, but for
 * on/off feature gates instead of numeric usage). Every module with a
 * gate-able feature calls isEnabled() here rather than reading Plan rows
 * itself.
 */
@Injectable()
export class EntitlementsService implements OnModuleInit {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapFreePlan();
  }

  /**
   * True if `key` is enabled for the workspace's current plan. A workspace
   * with no Subscription row (shouldn't happen post-bootstrap, but this
   * runs on every automation write so it must never hard-fail) defaults to
   * true — "everything free until a Subscription says otherwise," never the
   * inverse.
   */
  async isEnabled(workspaceId: string, key: FeatureKey): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { status: true, plan: { select: { features: true } } },
    });

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return true;
    }

    const features = subscription.plan.features as FeatureMap;
    return features[key] ?? true;
  }

  /**
   * Ensures a Workspace has a Subscription — called once at Workspace
   * creation (AuthService.register / loginOrRegisterWithGoogle). Never
   * touches an existing subscription (e.g. a later paid upgrade).
   */
  async ensureFreeSubscription(workspaceId: string): Promise<void> {
    const existing = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (existing) {
      return;
    }

    const freePlan = await this.prisma.plan.findUniqueOrThrow({ where: { slug: FREE_PLAN_SLUG } });
    await this.prisma.subscription.create({
      data: {
        workspaceId,
        planId: freePlan.id,
        provider: PaymentProviderType.NONE,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  /**
   * Idempotent: ensures exactly one Free plan exists with every currently
   * known FEATURE_KEYS value enabled. Safe to run on every process boot (api
   * and worker both do, via this hook) — upsert by slug, not insert.
   */
  private async bootstrapFreePlan(): Promise<void> {
    const allFeaturesOn: FeatureMap = Object.fromEntries(
      Object.values(FEATURE_KEYS).map((key) => [key, true]),
    );

    await this.prisma.plan.upsert({
      where: { slug: FREE_PLAN_SLUG },
      create: {
        slug: FREE_PLAN_SLUG,
        name: 'Free',
        monthlySendLimit: -1,
        aiFeaturesEnabled: true,
        maxInstagramAccounts: -1,
        features: allFeaturesOn,
      },
      // Re-assert every known feature as enabled on every boot, so a newly
      // added FEATURE_KEYS entry lands on Free automatically — features
      // ship enabled by default until explicitly gated (flip one key to
      // false later, no code change needed).
      update: {
        features: allFeaturesOn,
      },
    });

    this.logger.log(`Free plan bootstrapped with ${Object.keys(allFeaturesOn).length} feature flag(s) enabled`);
  }
}
