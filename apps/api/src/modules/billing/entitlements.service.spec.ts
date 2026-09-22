jest.mock('@nestjs/common', () => {
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return {
    Injectable: () => () => {},
    Logger,
  };
});

import { PaymentProviderType, SubscriptionStatus } from '@prisma/client';
import { EntitlementsService } from './entitlements.service';
import { FEATURE_KEYS, FREE_PLAN_SLUG } from './entitlements.constants';

function makeService(subscription: unknown) {
  const prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(subscription),
      create: jest.fn(),
    },
    plan: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'plan-free' }),
    },
  } as any;

  const service = new EntitlementsService(prisma);
  return { service, prisma };
}

describe('EntitlementsService.isEnabled', () => {
  it('returns true when the plan explicitly enables the feature', async () => {
    const { service } = makeService({
      status: SubscriptionStatus.ACTIVE,
      plan: { features: { [FEATURE_KEYS.LIVE_COMMENT_AUTOMATION]: true } },
    });

    expect(await service.isEnabled('workspace-1', FEATURE_KEYS.LIVE_COMMENT_AUTOMATION)).toBe(true);
  });

  it('returns false when the plan explicitly disables the feature (the future-gating path)', async () => {
    const { service } = makeService({
      status: SubscriptionStatus.ACTIVE,
      plan: { features: { [FEATURE_KEYS.LIVE_COMMENT_AUTOMATION]: false } },
    });

    expect(await service.isEnabled('workspace-1', FEATURE_KEYS.LIVE_COMMENT_AUTOMATION)).toBe(false);
  });

  it('defaults to true for a key missing from the plan features map', async () => {
    const { service } = makeService({
      status: SubscriptionStatus.ACTIVE,
      plan: { features: {} },
    });

    expect(await service.isEnabled('workspace-1', FEATURE_KEYS.AUTOMATION_TEMPLATES)).toBe(true);
  });

  it('defaults to true when the workspace has no Subscription row at all', async () => {
    const { service } = makeService(null);

    expect(await service.isEnabled('workspace-1', FEATURE_KEYS.LIVE_COMMENT_AUTOMATION)).toBe(true);
  });

  it('defaults to true for a non-ACTIVE subscription (e.g. PAST_DUE) rather than hard-locking a feature mid-outage', async () => {
    const { service } = makeService({
      status: SubscriptionStatus.PAST_DUE,
      plan: { features: { [FEATURE_KEYS.LIVE_COMMENT_AUTOMATION]: false } },
    });

    expect(await service.isEnabled('workspace-1', FEATURE_KEYS.LIVE_COMMENT_AUTOMATION)).toBe(true);
  });
});

describe('EntitlementsService.ensureFreeSubscription', () => {
  it('creates a NONE-provider subscription to the free plan when none exists', async () => {
    const { service, prisma } = makeService(null);

    await service.ensureFreeSubscription('workspace-1');

    expect(prisma.plan.findUniqueOrThrow).toHaveBeenCalledWith({ where: { slug: FREE_PLAN_SLUG } });
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        planId: 'plan-free',
        provider: PaymentProviderType.NONE,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  });

  it('does nothing when a subscription already exists (never overrides a paid plan)', async () => {
    const { service, prisma } = makeService({ id: 'existing-sub' });

    await service.ensureFreeSubscription('workspace-1');

    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });
});

describe('EntitlementsService.onModuleInit', () => {
  it('upserts the Free plan with every known FEATURE_KEYS value enabled', async () => {
    const { service, prisma } = makeService(null);

    await service.onModuleInit();

    expect(prisma.plan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: FREE_PLAN_SLUG },
        create: expect.objectContaining({
          slug: FREE_PLAN_SLUG,
          features: {
            [FEATURE_KEYS.LIVE_COMMENT_AUTOMATION]: true,
            [FEATURE_KEYS.AUTOMATION_TEMPLATES]: true,
          },
        }),
        update: {
          features: {
            [FEATURE_KEYS.LIVE_COMMENT_AUTOMATION]: true,
            [FEATURE_KEYS.AUTOMATION_TEMPLATES]: true,
          },
        },
      }),
    );
  });
});
