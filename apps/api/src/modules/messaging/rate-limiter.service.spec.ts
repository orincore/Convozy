jest.mock('@nestjs/common', () => ({
  Inject: () => () => {},
  Injectable: () => () => {},
  Global: () => () => {},
  Module: () => () => {},
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

import { RateLimiterService } from './rate-limiter.service';

function makeRedis() {
  const store = new Map<string, number>();
  return {
    incr: jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => 1),
  } as any;
}

describe('RateLimiterService', () => {
  it('allows requests under the per-hour limit', async () => {
    const redis = makeRedis();
    const service = new RateLimiterService(redis);

    const result = await service.tryConsume('account-1');

    expect(result.allowed).toBe(true);
    expect(redis.expire).toHaveBeenCalled(); // first request in the window sets the TTL
  });

  it('denies requests once the per-hour limit is exceeded, with a retryAfterSeconds', async () => {
    const redis = makeRedis();
    const service = new RateLimiterService(redis);

    let last;
    for (let i = 0; i < 101; i++) {
      last = await service.tryConsume('account-1');
    }

    expect(last!.allowed).toBe(false);
    expect(last!.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks separate accounts independently', async () => {
    const redis = makeRedis();
    const service = new RateLimiterService(redis);

    for (let i = 0; i < 100; i++) {
      await service.tryConsume('account-1');
    }
    const account1Denied = await service.tryConsume('account-1');
    const account2Allowed = await service.tryConsume('account-2');

    expect(account1Denied.allowed).toBe(false);
    expect(account2Allowed.allowed).toBe(true);
  });
});
