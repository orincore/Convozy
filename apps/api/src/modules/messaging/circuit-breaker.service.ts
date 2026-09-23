import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { InstagramAccountStatus } from '@prisma/client';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { InstagramService } from '../instagram/instagram.service';

const FAILURE_THRESHOLD = 5; // consecutive failures before tripping
const OPEN_COOLDOWN_SECONDS = 5 * 60; // 5 minutes
const FAILURE_COUNTER_TTL_SECONDS = 10 * 60; // failure streaks don't count across long gaps

/**
 * Per-account circuit breaker — ARCHITECTURE.md §5: "repeated failures for a
 * given IG account (e.g. expired token, persistent 429) trip a breaker that
 * pauses sends for that account and flags it in the dashboard, instead of
 * hot-looping failed retries." No half-open trial-request state — it just
 * auto-closes when the Redis key's TTL expires. That's simple and correct
 * enough for this phase; a real half-open probe is more machinery than this
 * product needs yet.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly instagramService: InstagramService,
  ) {}

  async isOpen(instagramAccountId: string): Promise<boolean> {
    const open = await this.redis.get(this.openKey(instagramAccountId));
    return open !== null;
  }

  async recordSuccess(instagramAccountId: string): Promise<void> {
    await this.redis.del(this.failureKey(instagramAccountId), this.openKey(instagramAccountId));
    // Always resets to ACTIVE, not gated on `isOpen()` first — the open key
    // has its own 5-minute TTL independent of how long the account actually
    // stays RATE_LIMITED for, so checking it here raced against real timing
    // and reliably missed the reset (see getSendCredentials' comment on
    // InstagramService for the full deadlock this caused). setAccountStatus
    // is a no-op write when the status already matches, so this is safe and
    // cheap to call on every successful send.
    await this.instagramService.setAccountStatus(instagramAccountId, InstagramAccountStatus.ACTIVE);
  }

  async recordFailure(instagramAccountId: string): Promise<void> {
    const key = this.failureKey(instagramAccountId);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, FAILURE_COUNTER_TTL_SECONDS);
    }

    if (count >= FAILURE_THRESHOLD) {
      await this.redis.set(this.openKey(instagramAccountId), '1', 'EX', OPEN_COOLDOWN_SECONDS);
      await this.instagramService.setAccountStatus(instagramAccountId, InstagramAccountStatus.RATE_LIMITED);
      this.logger.warn(
        `Circuit opened for Instagram account ${instagramAccountId} after ${count} consecutive failures — pausing sends for ${OPEN_COOLDOWN_SECONDS}s`,
      );
    }
  }

  private failureKey(instagramAccountId: string): string {
    return `circuit:${instagramAccountId}:failures`;
  }

  private openKey(instagramAccountId: string): string {
    return `circuit:${instagramAccountId}:open`;
  }
}
