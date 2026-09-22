import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

const WINDOW_SECONDS = 3600; // 1 hour, matching Meta's rolling-hour rate-limit model

// Conservative default, not Meta's exact published number: Meta's actual
// limits vary by call type (general Business Use Case calls vs. messaging-
// specific limits, which run considerably higher per Meta's own docs and
// third-party API guides) and can change without notice. This sits
// comfortably under every figure found — safer to under-send than to get
// externally rate-limited by Meta, which can affect account standing.
// Override via MESSAGE_RATE_LIMIT_PER_HOUR once the app's actual granted
// limit is confirmed from the App Dashboard's own rate-limit display.
const DEFAULT_LIMIT_PER_ACCOUNT_PER_HOUR = 100;

/**
 * Redis-backed fixed-window counter, keyed per Instagram account —
 * ARCHITECTURE.md §5: "Instagram/Meta limits apply per IG Business Account,
 * not globally... so one creator's high-traffic Reel can't starve or
 * throttle another creator's account." A fixed window (INCR + EXPIRE) can
 * allow up to ~2x the limit right at a window boundary; that's an accepted
 * tradeoff for staying simple — this guards against sustained overuse, not
 * billing-grade precision.
 */
@Injectable()
export class RateLimiterService {
  private readonly limitPerHour = DEFAULT_LIMIT_PER_ACCOUNT_PER_HOUR;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async tryConsume(instagramAccountId: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;
    const key = `ratelimit:${instagramAccountId}:${windowStart}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }

    if (count > this.limitPerHour) {
      const retryAfterSeconds = windowStart + WINDOW_SECONDS - Math.floor(Date.now() / 1000);
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true };
  }
}
