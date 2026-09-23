jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    constructor(
      public response: unknown,
      public status: number,
    ) {
      super(typeof response === 'string' ? response : JSON.stringify(response));
    }
  }
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return {
    Inject: () => () => {},
    Injectable: () => () => {},
    Global: () => () => {},
    Module: () => () => {},
    Logger,
    HttpException,
    HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

import { InstagramAccountStatus } from '@prisma/client';
import { CircuitBreakerService } from './circuit-breaker.service';

function makeRedis() {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    incr: jest.fn(async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: jest.fn(async () => 1),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    }),
  } as any;
}

describe('CircuitBreakerService', () => {
  it('is closed by default', async () => {
    const redis = makeRedis();
    const instagramService = { setAccountStatus: jest.fn() } as any;
    const service = new CircuitBreakerService(redis, instagramService);

    expect(await service.isOpen('account-1')).toBe(false);
  });

  it('stays closed under the failure threshold', async () => {
    const redis = makeRedis();
    const instagramService = { setAccountStatus: jest.fn() } as any;
    const service = new CircuitBreakerService(redis, instagramService);

    for (let i = 0; i < 4; i++) {
      await service.recordFailure('account-1');
    }

    expect(await service.isOpen('account-1')).toBe(false);
    expect(instagramService.setAccountStatus).not.toHaveBeenCalled();
  });

  it('opens after 5 consecutive failures and flags the account RATE_LIMITED', async () => {
    const redis = makeRedis();
    const instagramService = { setAccountStatus: jest.fn() } as any;
    const service = new CircuitBreakerService(redis, instagramService);

    for (let i = 0; i < 5; i++) {
      await service.recordFailure('account-1');
    }

    expect(await service.isOpen('account-1')).toBe(true);
    expect(instagramService.setAccountStatus).toHaveBeenCalledWith('account-1', InstagramAccountStatus.RATE_LIMITED);
  });

  it('recordSuccess closes the breaker and restores ACTIVE status if it was open', async () => {
    const redis = makeRedis();
    const instagramService = { setAccountStatus: jest.fn() } as any;
    const service = new CircuitBreakerService(redis, instagramService);

    for (let i = 0; i < 5; i++) {
      await service.recordFailure('account-1');
    }
    await service.recordSuccess('account-1');

    expect(await service.isOpen('account-1')).toBe(false);
    expect(instagramService.setAccountStatus).toHaveBeenLastCalledWith('account-1', InstagramAccountStatus.ACTIVE);
  });

  it('recordSuccess always resets status to ACTIVE, not gated on the circuit still being open', async () => {
    // Regression test: previously this only called setAccountStatus when
    // isOpen() was still true, which raced against the open key's own TTL —
    // once it expired naturally, a subsequent successful send would never
    // reset a RATE_LIMITED account back to ACTIVE, permanently blocking all
    // future sends (getSendCredentials refused non-ACTIVE accounts). Now it
    // always resets; setAccountStatus itself is a safe no-op write when the
    // status already matches (see InstagramService.setAccountStatus).
    const redis = makeRedis();
    const instagramService = { setAccountStatus: jest.fn() } as any;
    const service = new CircuitBreakerService(redis, instagramService);

    await service.recordSuccess('account-1');

    expect(instagramService.setAccountStatus).toHaveBeenCalledWith('account-1', InstagramAccountStatus.ACTIVE);
  });
});
